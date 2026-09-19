import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'
import { extrairTextoPdf } from '@/services/nfe-service'
import { insertNF, insertItens } from '@/services/nfService'
import { type ImportResult } from '@/services/import-excel'
import { type FaturamentoImportResult } from '@/services/import-faturamento'

import {
  detectBlinkReportType,
  parseMatrizVenda,
  parsePedidosCarteira,
  parseRelatorioVendasSemanal,
  type MatrizVendaItem,
  type PedidoCarteiraItem,
  type RelatorioSemanalMetaItem,
} from '@/services/blink-pdf-parsers'

export type DocumentType =
  | 'invoice_pdf'
  | 'client_spreadsheet'
  | 'sales_spreadsheet'
  | 'matriz_venda'
  | 'pedidos_carteira'
  | 'relatorio_vendas_semanal'
  | 'unknown'

export interface InvoiceItemExtracted {
  produto_codigo?: string
  produto_descricao: string
  produto_familia?: string
  produto_quantidade: number
  produto_valor_unitario: number
  produto_valor_total: number
}

export interface InvoiceExtracted {
  numero_nf: string
  serie?: string
  data_emissao: string
  emitente_nome?: string
  emitente_cnpj?: string
  destinatario_nome: string
  destinatario_cnpj?: string
  destinatario_uf?: string
  destinatario_cidade?: string
  valor_total_nota: number
  itens: InvoiceItemExtracted[]
}

export interface ClientExtracted {
  nome: string
  cnpj?: string
  email?: string
  telefone?: string
  estado?: string
  cidade?: string
  carteira?: string
  especie?: string
  profile_type?: string
}

export interface SaleExtracted {
  data: string
  cliente: string
  cliente_cnpj?: string
  produto: string
  produto_codigo?: string
  familia?: string
  quantidade: number
  valor: number
  numero_documento?: string
}

export interface MaestroAnalysisResult {
  success: boolean
  file_id: string
  mime_type: string
  document_type: DocumentType
  confidence: number
  summary: string
  preview_rows: Array<Record<string, unknown>>
  data: {
    invoices?: InvoiceExtracted[]
    clients?: ClientExtracted[]
    sales?: SaleExtracted[]
    matriz_venda?: MatrizVendaItem[]
    pedidos_carteira?: PedidoCarteiraItem[]
    relatorio_vendas_semanal?: RelatorioSemanalMetaItem[]
  }
}

export interface ExecutionResult {
  success: boolean
  inserted: number
  skippedDuplicates: number
  errorsCount: number
  errorDetails?: Array<{ row: number; reason: string }>
  navigationTab: string
  navigationLabel: string
  message: string
}

/**
 * Faz upload do arquivo para a coleção `maestro_uploads` do PocketBase.
 * Gera nome único combinando user_id + UUID.
 */
export async function uploadMaestroFile(file: File): Promise<{
  id: string
  fileName: string
  url: string
}> {
  const user = pb.authStore.model
  if (!user?.id) {
    throw new Error('Usuário não autenticado.')
  }

  // Validação de tamanho: máximo 20 MB
  const maxBytes = 20 * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error('O arquivo excede o limite máximo permitido de 20 MB.')
  }

  // Gera nome seguro combinando user id + UUID + extensão
  const ext = file.name.split('.').pop() || 'bin'
  const randomSuffix =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 12)
  const uniqueFileName = `${user.id}_${randomSuffix}.${ext}`

  const formData = new FormData()
  formData.append('arquivo', file, uniqueFileName)
  formData.append('nome_original', file.name)
  formData.append('tamanho', String(file.size))
  formData.append('mime_type', file.type || 'application/octet-stream')
  formData.append('user_id', user.id)

  const record = await pb.collection('maestro_uploads').create(formData)
  const fileUrl = pb.files.getURL(record, record.arquivo)

  return {
    id: record.id,
    fileName: file.name,
    url: fileUrl,
  }
}

/**
 * Lê o arquivo localmente para extrair texto (se PDF) ou rows (se planilha)
 * para enviar de forma rica para o hook maestro/analyze.
 */
export async function extractFileContentLocally(file: File): Promise<{
  extractedText?: string
  rows?: Array<Record<string, unknown>>
}> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()

  if (ext === 'pdf' || file.type === 'application/pdf') {
    try {
      const text = await extrairTextoPdf(file)
      return { extractedText: text }
    } catch (pdfErr) {
      console.warn('Falha na extração de texto PDF cliente:', pdfErr)
      return { extractedText: '' }
    }
  }

  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheet = wb.SheetNames[0]
      if (firstSheet) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstSheet], {
          defval: '',
        })
        return { rows }
      }
    } catch (sheetErr) {
      console.warn('Falha na leitura de planilha cliente:', sheetErr)
    }
  }

  return {}
}

/**
 * Envia o arquivo já salvo e o conteúdo extraído para a análise do MAESTRO
 */
export async function analyzeMaestroFile(params: {
  fileId: string
  file: File
  extractedText?: string
  rows?: Array<Record<string, unknown>>
}): Promise<MaestroAnalysisResult> {
  const token = pb.authStore.token
  if (!token) {
    throw new Error('Nao autorizado')
  }

  const endpoint = `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/maestro/analyze`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      file_id: params.fileId,
      mime_type: params.file.type,
      extracted_text: params.extractedText || '',
      rows: params.rows || [],
    }),
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    if (res.status === 401) {
      throw new Error('Nao autorizado')
    }
    throw new Error(
      errorBody.error || 'Não foi possível analisar o arquivo. Tente novamente mais tarde.',
    )
  }

  const data: MaestroAnalysisResult = await res.json()

  // Se o hook retornou ou o texto local indica um dos 3 novos tipos de relatório Blink,
  // enriquecer os dados usando os parsers locais de alta tolerância
  const localType = detectBlinkReportType(params.extractedText || '', params.file.name)
  const finalDocType =
    data.document_type === 'unknown' && localType !== 'unknown'
      ? localType
      : data.document_type || localType

  if (finalDocType === 'matriz_venda') {
    const parsed = parseMatrizVenda(params.extractedText || '', params.file.name)
    const uniqueClients = new Set(parsed.map((p) => p.cliente)).size
    data.document_type = 'matriz_venda'
    data.data.matriz_venda = parsed
    data.summary = `${uniqueClients} clientes e ${parsed.length} valores mensais encontrados.`
    data.preview_rows = parsed.slice(0, 5).map((p) => ({
      Cliente: p.cliente,
      País: p.pais,
      Carteira: p.carteira,
      Grupo: p.grupo_cliente,
      Mês: `${p.mes.toUpperCase()}/${p.ano}`,
      Valor: `R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    }))
  } else if (finalDocType === 'pedidos_carteira') {
    const parsed = parsePedidosCarteira(params.extractedText || '', params.file.name)
    const uniqueClients = new Set(parsed.map((p) => p.cliente)).size
    data.document_type = 'pedidos_carteira'
    data.data.pedidos_carteira = parsed
    data.summary = `${uniqueClients} clientes e ${parsed.length} pedidos em carteira encontrados.`
    data.preview_rows = parsed.slice(0, 5).map((p) => ({
      Cliente: p.cliente,
      Segmento: p.segmento,
      Mês: `${p.mes.toUpperCase()}/${p.ano}`,
      Valor: `R$ ${p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    }))
  } else if (finalDocType === 'relatorio_vendas_semanal') {
    const parsed = parseRelatorioVendasSemanal(params.extractedText || '', params.file.name)
    data.document_type = 'relatorio_vendas_semanal'
    data.data.relatorio_vendas_semanal = parsed
    data.summary = `${parsed.length} metas e comparativos de vendas identificados.`
    data.preview_rows = parsed.slice(0, 5).map((p) => ({
      Bloco: p.periodo_rotulo,
      Canal: p.canal,
      Vendedor: p.vendedor_nome || 'Consolidado',
      Carteira: p.carteira || '-',
      Planejado: `R$ ${p.planejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      Realizado: `R$ ${p.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      Atingimento: `${p.atingimento_pct}%`,
    }))
  }

  return data
}

/**
 * Executa a tarefa de Importação de Notas Fiscais:
 * - Valida campos obrigatórios (número NF, data emissão, destinatário, valor total)
 * - Pula duplicatas por número de NF já existente na coleção notas_fiscais
 * - Insere em notas_fiscais e nf_itens
 * - Cria registro no histórico de auditoria (activity_logs)
 */
export async function executeImportInvoices(
  invoices: InvoiceExtracted[],
  originalFileName?: string,
): Promise<ExecutionResult> {
  let inserted = 0
  let skippedDuplicates = 0
  const errorsList: Array<{ row: number; reason: string }> = []

  // Carregar NFs existentes para desduplicar
  const existingNfs = await pb
    .collection('notas_fiscais')
    .getFullList({ fields: 'numero_nf' })
    .catch(() => [])
  const existingSet = new Set(existingNfs.map((n) => String(n.numero_nf || '').trim()))

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i]
    const rowNum = i + 1
    const cleanNum = String(inv.numero_nf || '').trim()

    if (!cleanNum) {
      errorsList.push({
        row: rowNum,
        reason: 'Número da nota fiscal ausente.',
      })
      continue
    }

    if (!inv.destinatario_nome?.trim()) {
      errorsList.push({
        row: rowNum,
        reason: `Nota ${cleanNum}: Razão social do destinatário ausente.`,
      })
      continue
    }

    if (existingSet.has(cleanNum)) {
      skippedDuplicates++
      continue
    }

    try {
      const nfId = await insertNF({
        numero_nf: cleanNum,
        serie: inv.serie || '1',
        data_emissao: inv.data_emissao,
        destinatario_nome: inv.destinatario_nome,
        destinatario_cnpj: inv.destinatario_cnpj,
        destinatario_uf: inv.destinatario_uf,
        destinatario_municipio: inv.destinatario_cidade,
        valor_total_nota: inv.valor_total_nota || 0,
        valor_total_produtos: inv.valor_total_nota || 0,
        status: 'importada',
      })

      if (inv.itens && inv.itens.length > 0) {
        await insertItens(
          nfId,
          inv.itens.map((it) => ({
            produto_codigo: it.produto_codigo || 'BPMI.OR015',
            produto_descricao: it.produto_descricao || 'Produto',
            produto_ncm: '2309.90.90',
            produto_cst: '100',
            produto_cfop: '6102',
            produto_unidade: 'KG',
            produto_quantidade: it.produto_quantidade || 1,
            produto_valor_unitario: it.produto_valor_unitario || 0,
            produto_valor_total:
              it.produto_valor_total ||
              (it.produto_quantidade || 1) * (it.produto_valor_unitario || 0),
          })),
          inv.valor_total_nota,
        )
      }

      existingSet.add(cleanNum)
      inserted++
    } catch (err) {
      errorsList.push({
        row: rowNum,
        reason: `Nota ${cleanNum}: ${(err as Error).message}`,
      })
    }
  }

  // Registrar histórico de importação na coleção de auditoria
  try {
    const userId = pb.authStore.model?.id
    if (userId) {
      await pb.collection('activity_logs').create({
        user: userId,
        action: 'Importação Maestro - Notas Fiscais',
        details: `Maestro importou ${inserted} nota(s) fiscal(is), ignorou ${skippedDuplicates} duplicata(s) de "${originalFileName || 'arquivo.pdf'}".`,
        target_collection: 'notas_fiscais',
        origem: 'painel',
        tipo: 'outro',
      })
    }
  } catch (logErr) {
    console.warn('Erro ao registrar log de importação:', logErr)
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'notas_fiscais' } }),
      )
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'faturamento' } }))
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'activity_logs' } }),
      )
    } catch {
      // ignore
    }
  }

  return {
    success: inserted > 0 || invoices.length === skippedDuplicates,
    inserted,
    skippedDuplicates,
    errorsCount: errorsList.length,
    errorDetails: errorsList,
    navigationTab: '/pedidos',
    navigationLabel: 'Ver Notas Fiscais / Pedidos',
    message: `Processamento concluído: ${inserted} nota(s) fiscal(is) importada(s), ${skippedDuplicates} duplicada(s) ignorada(s).`,
  }
}

/**
 * Executa o cadastro/upsert de clientes:
 * - Upsert por CNPJ na tabela `factories`
 * - Se não houver CNPJ ou não existir, cria novo cliente
 * - Se existir, atualiza dados
 */
export async function executeRegisterClients(
  clients: ClientExtracted[],
  originalFileName?: string,
): Promise<ExecutionResult> {
  const formattedRows = clients.map((c) => ({
    nome: c.nome || '',
    cnpj: c.cnpj || '',
    email: c.email || '',
    telefone: c.telefone || '',
    estado: c.estado || '',
    cidade: c.cidade || '',
    carteira: c.carteira || '',
    especie: c.especie || '',
  }))

  const result = await pb.send<ImportResult>('/backend/v1/importar-excel', {
    method: 'POST',
    body: JSON.stringify({ rows: formattedRows }),
    headers: { 'Content-Type': 'application/json' },
  })

  const errorsList: Array<{ row: number; reason: string }> = (result.erros || []).map((e) => ({
    row: e.linha,
    reason: e.erro,
  }))

  // Log de auditoria
  try {
    const userId = pb.authStore.model?.id
    if (userId) {
      await pb.collection('activity_logs').create({
        user: userId,
        action: 'Cadastro Maestro - Clientes',
        details: `Maestro cadastrou ${result.criados} cliente(s) e atualizou ${result.atualizados} de "${originalFileName || 'planilha.xlsx'}".`,
        target_collection: 'factories',
        origem: 'painel',
        tipo: 'outro',
      })
    }
  } catch (logErr) {
    console.warn('Erro ao registrar log de clientes:', logErr)
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'activity_logs' } }),
      )
    } catch {
      // ignore
    }
  }

  return {
    success: result.success && (result.criados > 0 || result.atualizados > 0),
    inserted: result.criados + result.atualizados,
    skippedDuplicates: result.duplicatas,
    errorsCount: errorsList.length,
    errorDetails: errorsList,
    navigationTab: '/cadastro',
    navigationLabel: 'Ver Clientes Cadastrados',
    message: `Cadastro concluído: ${result.criados} novo(s) cliente(s) cadastrado(s), ${result.atualizados} atualizado(s), ${result.duplicatas} duplicata(s) ignorada(s).`,
  }
}

/**
 * Executa a importação de planilha de faturamento/vendas
 */
export async function executeImportSales(
  sales: SaleExtracted[],
  originalFileName?: string,
): Promise<ExecutionResult> {
  const mappedRows = sales.map((s) => ({
    data: s.data || new Date().toISOString().split('T')[0],
    cliente: s.cliente || '',
    cliente_cnpj: s.cliente_cnpj || '',
    produto: s.produto || '',
    produto_codigo: s.produto_codigo || '',
    familia: s.familia || 'Geral',
    quantidade: s.quantidade || 1,
    valor_total_brl: s.valor || 0,
    numero_documento: s.numero_documento || '',
    status: 'realizado',
  }))

  const res = await pb.send<FaturamentoImportResult>('/backend/v1/importar-faturamento', {
    method: 'POST',
    body: JSON.stringify({
      rows: mappedRows,
      options: { criarClienteNaoEncontrado: true },
    }),
    headers: { 'Content-Type': 'application/json' },
  })

  const errorsList: Array<{ row: number; reason: string }> = (
    res.error_details ||
    res.erros ||
    []
  ).map((e) => ({
    row: e.linha,
    reason: e.erro,
  }))

  try {
    const userId = pb.authStore.model?.id
    if (userId) {
      await pb.collection('activity_logs').create({
        user: userId,
        action: 'Importação Maestro - Vendas/Faturamento',
        details: `Maestro importou ${res.imported} registro(s) de faturamento de "${originalFileName || 'planilha.xlsx'}".`,
        target_collection: 'faturamento',
        origem: 'painel',
        tipo: 'outro',
      })
    }
  } catch (logErr) {
    console.warn('Erro ao registrar log de vendas:', logErr)
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'faturamento' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'historico_vendas' } }),
      )
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'activity_logs' } }),
      )
    } catch {
      // ignore
    }
  }

  return {
    success: res.success,
    inserted: res.imported,
    skippedDuplicates: res.skipped_duplicates,
    errorsCount: errorsList.length,
    errorDetails: errorsList,
    navigationTab: '/historico-vendas',
    navigationLabel: 'Ver Histórico de Vendas',
    message: `Importação de vendas concluída: ${res.imported} registro(s) inserido(s), ${res.skipped_duplicates} duplicata(s) ignorada(s).`,
  }
}

/**
 * 1. Executa a importação do PDF Matriz de Venda
 * Destino: coleção de faturamento / histórico de vendas (mesma coleção que a importação de Excel grava).
 * Grava apenas no nível do cliente (NÃO duplica totais de grupo/carteira/país).
 * Deduplicação: mesmo cliente + mês/ano + valor não grava duas vezes.
 */
export async function executeImportMatrizVenda(
  items: MatrizVendaItem[],
  originalFileName?: string,
): Promise<ExecutionResult> {
  const MESES_MAP_NUM: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    março: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  }

  // Converter itens para linhas de faturamento
  const rows = items.map((it) => {
    const mesNum = MESES_MAP_NUM[it.mes.toLowerCase()] || 1
    const mesStr = mesNum < 10 ? `0${mesNum}` : `${mesNum}`
    const dataDoc = `${it.ano}-${mesStr}-01`

    return {
      data: dataDoc,
      data_documento: dataDoc,
      cliente: it.cliente,
      cliente_nome: it.cliente,
      pais: it.pais || 'Brasil',
      country: it.pais || 'Brasil',
      familia: it.carteira,
      familia_de_produtos: it.carteira,
      especie: it.carteira,
      canal_vendas: it.grupo_cliente || 'Direto',
      quantidade: 1,
      valor_total_brl: it.valor,
      valor: it.valor,
      numero_documento: `MV-${it.ano}-${mesStr}`,
      status: 'realizado',
    }
  })

  const res = await pb.send<FaturamentoImportResult>('/backend/v1/importar-faturamento', {
    method: 'POST',
    body: JSON.stringify({
      rows,
      options: {
        criarClienteNaoEncontrado: true,
        fileName: originalFileName || 'Matriz_de_Venda.pdf',
      },
    }),
    headers: { 'Content-Type': 'application/json' },
  })

  // Também manter a tabela matriz_vendas em sincronia se aplicável
  try {
    for (const it of items) {
      if (it.valor > 0) {
        // Checar se já existe na matriz_vendas
        const existing = await pb
          .collection('matriz_vendas')
          .getFirstListItem(
            `razao_social = "${it.cliente.replace(/"/g, '\\"')}" && mes = "${it.mes}" && pais = "${it.pais}"`,
          )
          .catch(() => null)

        if (!existing) {
          const carteiraUpper = it.carteira.toUpperCase()
          const validCarteira = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA'].includes(
            carteiraUpper,
          )
            ? carteiraUpper
            : carteiraUpper.includes('SU')
              ? 'SUINOS'
              : 'AVES'

          await pb
            .collection('matriz_vendas')
            .create({
              pais: it.pais,
              carteira: validCarteira,
              grupo_cliente: it.grupo_cliente,
              razao_social: it.cliente,
              mes: it.mes,
              valor: it.valor,
              atualizado_em: new Date().toISOString(),
            })
            .catch(() => {})
        }
      }
    }
  } catch (errSync) {
    console.warn('Erro ao sincronizar matriz_vendas complementar:', errSync)
  }

  // Notificar realtime do CRM
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'faturamento' } }))
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'historico_vendas' } }),
      )
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'matriz_vendas' } }),
      )
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'factories' } }))
    } catch {
      /* intentionally ignored */
    }
  }

  const errorsList = (res.error_details || res.erros || []).map((e) => ({
    row: e.linha,
    reason: e.erro,
  }))

  return {
    success: res.success,
    inserted: res.imported,
    skippedDuplicates: res.skipped_duplicates,
    errorsCount: errorsList.length,
    errorDetails: errorsList,
    navigationTab: '/historico-vendas',
    navigationLabel: 'Ver Faturamento / Histórico de Vendas',
    message: `Matriz de Venda importada: ${res.imported} valor(es) gravado(s) em faturamento/histórico, ${res.skipped_duplicates} duplicata(s) ignorada(s).`,
  }
}

/**
 * 2. Executa a importação do PDF Pedidos em Carteira
 * Destino: coleção de pedidos em carteira (pedidos_carteira)
 * Deduplicação: cliente + mês + ano + valor
 */
export async function executeImportPedidosCarteira(
  items: PedidoCarteiraItem[],
  originalFileName?: string,
): Promise<ExecutionResult> {
  let inserted = 0
  let skippedDuplicates = 0
  const errorsList: Array<{ row: number; reason: string }> = []

  // Calcular total geral por cliente para preencher campo total_geral
  const totalsByClient: Record<string, number> = {}
  for (const it of items) {
    totalsByClient[it.cliente] = (totalsByClient[it.cliente] || 0) + it.valor
  }

  // Buscar registros existentes para deduplicar
  const existingRecords = await pb
    .collection('pedidos_carteira')
    .getFullList<{ id: string; marca: string; mes: string; valor: number; ano?: number }>()
    .catch(() => [])

  const existingSet = new Set(
    existingRecords.map(
      (r) => `${r.marca.trim().toLowerCase()}__${r.mes.trim().toLowerCase()}__${r.valor}`,
    ),
  )

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const rowNum = i + 1
    const dedupeKey = `${it.cliente.trim().toLowerCase()}__${it.mes.trim().toLowerCase()}__${it.valor}`

    if (existingSet.has(dedupeKey)) {
      skippedDuplicates++
      continue
    }

    try {
      await pb.collection('pedidos_carteira').create({
        marca: it.cliente,
        cliente: it.cliente,
        mes: it.mes.toLowerCase(),
        ano: it.ano,
        segmento: it.segmento,
        valor: it.valor,
        total_geral: totalsByClient[it.cliente] || it.valor,
        atualizado_em: new Date().toISOString(),
      })
      existingSet.add(dedupeKey)
      inserted++
    } catch (err) {
      errorsList.push({
        row: rowNum,
        reason: `Cliente ${it.cliente} (${it.mes}): ${(err as Error).message}`,
      })
    }
  }

  // Registrar em import_history
  try {
    const fName = originalFileName || 'pedidos_em_carteira.pdf'
    const parts = fName.split('.')
    const fType = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'pdf'
    const statusVal = errorsList.length === 0 ? 'sucesso' : inserted > 0 ? 'parcial' : 'erro'
    const errText =
      errorsList.length > 0
        ? errorsList
            .map((e) => `Linha ${e.row}: ${e.reason}`)
            .slice(0, 10)
            .join('\n')
        : `Importados ${inserted} pedidos em carteira (${skippedDuplicates} duplicatas ignoradas).`

    await pb.collection('import_history').create({
      file_name: fName,
      file_type: fType,
      imported_at: new Date().toISOString(),
      total_rows: items.length,
      imported_rows: inserted,
      error_rows: errorsList.length,
      status: statusVal,
      details: errText,
    })
  } catch {
    /* intentionally ignored */
  }

  // Notificar listeners
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('blink:datasync', { detail: { entity: 'pedidos_carteira' } }),
      )
    } catch {
      /* intentionally ignored */
    }
  }

  return {
    success: inserted > 0 || items.length === skippedDuplicates,
    inserted,
    skippedDuplicates,
    errorsCount: errorsList.length,
    errorDetails: errorsList,
    navigationTab: '/pedidos-carteira',
    navigationLabel: 'Ver Pedidos em Carteira',
    message: `Pedidos em carteira importados: ${inserted} inserido(s), ${skippedDuplicates} duplicata(s) ignorada(s).`,
  }
}

/**
 * 3. Executa a importação do PDF Relatório de Vendas Semanal
 * Destino: PLANEJADO -> coleção de metas; REALIZADO -> comparativo de metas / realizado
 * Preserva canal (BLINK/BR/INDUSTRIA/PREMIXEIRAS/DISTRIBUIDORAS/LATAM) e vendedor/carteira
 */
export async function executeImportRelatorioVendasSemanal(
  items: RelatorioSemanalMetaItem[],
  originalFileName?: string,
): Promise<ExecutionResult> {
  let inserted = 0
  let skippedDuplicates = 0
  const errorsList: Array<{ row: number; reason: string }> = []

  // Carregar gestao_tecnica para vincular vendedores
  const gestaoTecnicaList = await pb
    .collection('gestao_tecnica')
    .getFullList<{ id: string; nome: string; carteira?: string }>()
    .catch(() => [])

  // Mapa de canal válido para o enum do PB se aplicável
  const CANAL_MAP: Record<string, string> = {
    BLINK: 'Direto',
    BR: 'Direto',
    INDUSTRIA: 'Indústria',
    PREMIXEIRAS: 'Premixera',
    DISTRIBUIDORAS: 'Distribuidor',
    LATAM: 'Direto',
  }

  const ESPECIE_MAP: Record<string, 'BOVINO' | 'SUINO' | 'AVE' | 'PET' | 'AQUA'> = {
    Ruminantes: 'BOVINO',
    Suínos: 'SUINO',
    Suinos: 'SUINO',
    Aves: 'AVE',
    Pets: 'PET',
    Aqua: 'AQUA',
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const rowNum = i + 1

    // Apenas itens que tenham planejado ou realizado > 0
    if (it.planejado <= 0 && it.realizado <= 0) {
      continue
    }

    // Vincular vendedor se houver
    let matchedVendedorId = ''
    if (it.vendedor_nome) {
      const vNorm = it.vendedor_nome.toLowerCase().trim()
      const found = gestaoTecnicaList.find(
        (g) =>
          g.nome.toLowerCase().trim().includes(vNorm) ||
          vNorm.includes(g.nome.toLowerCase().trim()),
      )
      if (found) {
        matchedVendedorId = found.id
      }
    }

    const canalNormalizado = CANAL_MAP[it.canal.toUpperCase()] || 'Direto'
    const especieNormalizada = it.carteira ? ESPECIE_MAP[it.carteira] : undefined

    try {
      // Checar se já existe meta para o mesmo período, canal e vendedor
      const existingFilter = matchedVendedorId
        ? `periodo = "${it.periodo}" && vendedor_id = "${matchedVendedorId}" && canal_vendas = "${canalNormalizado}"`
        : `periodo = "${it.periodo}" && canal_vendas = "${canalNormalizado}"`

      const existingMeta = await pb
        .collection('metas')
        .getFirstListItem(existingFilter)
        .catch(() => null)

      if (existingMeta) {
        // Atualizar valores de planejado e realizado
        await pb.collection('metas').update(existingMeta.id, {
          meta_valor: it.planejado || existingMeta.meta_valor,
          valor_realizado: it.realizado || existingMeta.valor_realizado,
          canal: it.canal,
          canal_vendas: canalNormalizado,
          vendedor_nome: it.vendedor_nome || existingMeta.vendedor_nome,
          tipo_resultado: it.periodo_rotulo,
          atualizado_em: new Date().toISOString(),
        })
        skippedDuplicates++
      } else {
        await pb.collection('metas').create({
          periodo: it.periodo,
          meta_valor: it.planejado,
          valor_realizado: it.realizado,
          canal: it.canal,
          canal_vendas: canalNormalizado,
          vendedor_id: matchedVendedorId || null,
          vendedor_nome: it.vendedor_nome || '',
          especie: especieNormalizada || null,
          tipo_resultado: it.periodo_rotulo,
          atualizado_em: new Date().toISOString(),
        })
        inserted++
      }
    } catch (err) {
      errorsList.push({
        row: rowNum,
        reason: `${it.periodo_rotulo} (${it.canal}): ${(err as Error).message}`,
      })
    }
  }

  // Registrar em import_history
  try {
    const fName = originalFileName || 'relatorio_vendas_semanal.pdf'
    const parts = fName.split('.')
    const fType = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'pdf'
    const statusVal = errorsList.length === 0 ? 'sucesso' : inserted > 0 ? 'parcial' : 'erro'
    const errText =
      errorsList.length > 0
        ? errorsList
            .map((e) => `Linha ${e.row}: ${e.reason}`)
            .slice(0, 10)
            .join('\n')
        : `Importadas ${inserted} novas metas (${skippedDuplicates} atualizadas/duplicadas).`

    await pb.collection('import_history').create({
      file_name: fName,
      file_type: fType,
      imported_at: new Date().toISOString(),
      total_rows: items.length,
      imported_rows: inserted,
      error_rows: errorsList.length,
      status: statusVal,
      details: errText,
    })
  } catch {
    /* intentionally ignored */
  }

  // Notificar realtime do CRM
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'metas' } }))
      window.dispatchEvent(new CustomEvent('blink:datasync', { detail: { entity: 'faturamento' } }))
    } catch {
      /* intentionally ignored */
    }
  }

  return {
    success: inserted > 0 || skippedDuplicates > 0,
    inserted,
    skippedDuplicates,
    errorsCount: errorsList.length,
    errorDetails: errorsList,
    navigationTab: '/metas',
    navigationLabel: 'Ver Metas e Desempenho',
    message: `Relatório de Vendas Semanal importado: ${inserted} meta(s) inserida(s), ${skippedDuplicates} atualizada(s)/comparada(s).`,
  }
}
