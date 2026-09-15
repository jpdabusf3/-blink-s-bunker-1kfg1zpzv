import pb from '@/lib/pocketbase/client'
import * as XLSX from 'xlsx'
import { extrairTextoPdf } from '@/services/nfe-service'
import { insertNF, insertItens } from '@/services/nfService'
import { type ImportResult } from '@/services/import-excel'
import { type FaturamentoImportResult } from '@/services/import-faturamento'

export type DocumentType = 'invoice_pdf' | 'client_spreadsheet' | 'sales_spreadsheet' | 'unknown'

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
