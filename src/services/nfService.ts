import pb from '@/lib/pocketbase/client'
import { normalizeNumberBR } from '@/lib/utils'

export interface ParsedItem {
  produto_codigo: string
  produto_descricao: string
  produto_ncm?: string
  produto_cst?: string
  produto_cfop?: string
  produto_unidade?: string
  produto_quantidade: number
  produto_valor_unitario: number
  produto_valor_total: number
  bc_icms?: number
  valor_icms?: number
  aliq_icms?: number
  valor_ipi?: number
  aliq_ipi?: number
  lotes?: Array<{
    lote_codigo: string
    lote_quantidade: number
  }>
}

export interface ParsedLote {
  item_index?: number
  produto_codigo?: string
  lote_codigo: string
  lote_quantidade: number
}

export interface ParsedNFData {
  // Bloco A — Cabeçalho
  numero_nf: string
  serie?: string
  chave_acesso?: string
  data_emissao: string
  natureza_operacao?: string
  protocolo_autorizacao?: string
  valor_total_nota: number | null
  valor_total_produtos?: number
  valor_aproximado_tributos?: number
  raw_text?: string
  warnings?: string[]

  // Bloco B — Destinatário
  destinatario_nome: string
  destinatario_cnpj?: string
  destinatario_ie?: string
  destinatario_endereco?: string
  destinatario_bairro?: string
  destinatario_cep?: string
  destinatario_municipio?: string
  destinatario_uf?: string
  destinatario_fone?: string

  // Bloco C — Impostos e Frete
  bc_icms?: number
  valor_icms?: number
  valor_frete?: number
  valor_seguro?: number
  desconto?: number
  outras_despesas?: number
  valor_ipi?: number
  frete_modalidade?: 'CIF' | 'FOB'
  volumes_quantidade?: number
  volumes_especie?: string
  peso_bruto?: number
  peso_liquido?: number
  fatura_numero?: string
  fatura_vencimento?: string
  fatura_valor?: number
  ordem_compra?: string

  // Bloco D — CRM
  especie_destino?:
    | 'PET'
    | 'AVES'
    | 'SUINOS'
    | 'RUMINANTES'
    | 'AQUA'
    | 'DISTRIBUICAO'
    | 'OUTRO'
    | ''
  canal_vendas?:
    | 'Direto'
    | 'Distribuidor'
    | 'Industria'
    | 'Premixera'
    | 'Cooperativa'
    | 'Online'
    | ''
  gestor_tecnico_id?: string
  vendedor_id?: string

  // Bloco E — Itens & Lotes
  itens: ParsedItem[]
  lotes?: ParsedLote[]

  // Metadata
  arquivo_pdf_url?: string
  file_record_id?: string
}

export interface EquipeOption {
  id: string
  nome: string
  cargo: 'Gestor Tecnico' | 'Vendedor'
  email?: string
  regiao?: string
  ativo: boolean
}

export interface AtribuicaoClienteRecord {
  id: string
  cliente_nome: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  observacoes?: string
}

export const ESPECIE_DESTINO_OPTIONS = [
  'PET',
  'AVES',
  'SUINOS',
  'RUMINANTES',
  'AQUA',
  'DISTRIBUICAO',
  'OUTRO',
] as const

export const CANAL_VENDAS_OPTIONS = [
  'Direto',
  'Distribuidor',
  'Industria',
  'Premixera',
  'Cooperativa',
  'Online',
] as const

/**
 * Uploads a PDF file into PocketBase logical storage ("notas-fiscais" storage / notas_fiscais_files collection).
 * Returns the public access URL and created record id.
 */
export async function uploadToStorage(file: File): Promise<{ url: string; fileRecordId: string }> {
  try {
    const formData = new FormData()
    formData.append('arquivo', file)
    formData.append('nome_original', file.name)
    formData.append('tamanho', String(file.size))
    if (pb.authStore.model?.id) {
      formData.append('user_id', pb.authStore.model.id)
    }

    const record = await pb
      .collection('notas_fiscais_files')
      .create<{ id: string; arquivo: string }>(formData)
    const fileUrl = pb.files.getUrl(record, record.arquivo)
    return {
      url: fileUrl,
      fileRecordId: record.id,
    }
  } catch (err: unknown) {
    console.error('Erro ao enviar arquivo para armazenamento:', err)
    throw new Error('Erro ao armazenar arquivo. Tente novamente.')
  }
}

/**
 * Deletes uploaded PDF file from storage on discard.
 */
export async function deleteFromStorage(fileRecordIdOrUrl: string): Promise<boolean> {
  try {
    if (!fileRecordIdOrUrl) return false
    // If it is a full URL, try to extract the record ID
    if (fileRecordIdOrUrl.startsWith('http') || fileRecordIdOrUrl.includes('/api/files/')) {
      const parts = fileRecordIdOrUrl.split('/')
      const filesIndex = parts.indexOf('files')
      if (filesIndex !== -1 && parts[filesIndex + 2]) {
        const recordId = parts[filesIndex + 2]
        await pb.collection('notas_fiscais_files').delete(recordId)
        return true
      }
    } else {
      await pb.collection('notas_fiscais_files').delete(fileRecordIdOrUrl)
      return true
    }
    return false
  } catch (err) {
    console.warn('deleteFromStorage failed:', err)
    return false
  }
}

/**
 * Calls server-side parse-nf-pdf function.
 */
export async function callParseFunction(pdfUrl: string, rawText?: string): Promise<ParsedNFData> {
  try {
    const payload: { pdf_url: string; raw_text?: string } = { pdf_url: pdfUrl }
    if (rawText) payload.raw_text = rawText

    const res = await pb.send<ParsedNFData>('/backend/v1/parse-nf-pdf', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (rawText && !res.raw_text) {
      res.raw_text = rawText
    }
    return res
  } catch (err: unknown) {
    console.error('Erro ao chamar parse-nf-pdf:', err)
    const errorObj = err as
      | { status?: number; data?: { error?: string }; message?: string }
      | undefined
    if (errorObj?.status === 401) {
      throw new Error('Nao autorizado')
    }
    if (errorObj?.data?.error) {
      throw new Error(errorObj.data.error)
    }
    throw new Error('Erro ao extrair dados da NF. Verifique se o arquivo e um DANFE valido.')
  }
}

/**
 * Alias for callParseFunction to support direct parseNF calls
 */
export async function parseNF(pdfUrlOrRawText: string, rawText?: string): Promise<ParsedNFData> {
  return callParseFunction(pdfUrlOrRawText, rawText)
}

/**
 * Queries atribuicao_clientes for client matching to autofill gestor_tecnico and vendedor.
 */
export async function getAtribuicao(
  destinatarioNome: string,
): Promise<AtribuicaoClienteRecord | null> {
  if (!destinatarioNome || !destinatarioNome.trim()) return null
  try {
    const cleanName = destinatarioNome.trim().replace(/['"\\]/g, '')
    const records = await pb
      .collection('atribuicao_clientes')
      .getList<AtribuicaoClienteRecord>(1, 1, {
        filter: `cliente_nome ~ "${cleanName}"`,
      })
    return records.items[0] || null
  } catch {
    return null
  }
}

/**
 * Fetches active Gestores Técnicos from equipe table.
 */
export async function getGestoresTecnicosEquipe(): Promise<EquipeOption[]> {
  try {
    return await pb.collection('equipe').getFullList<EquipeOption>({
      filter: 'cargo = "Gestor Tecnico" && ativo = true',
      sort: 'nome',
    })
  } catch {
    return []
  }
}

/**
 * Fetches active Vendedores from equipe table.
 */
export async function getVendedoresEquipe(): Promise<EquipeOption[]> {
  try {
    return await pb.collection('equipe').getFullList<EquipeOption>({
      filter: 'cargo = "Vendedor" && ativo = true',
      sort: 'nome',
    })
  } catch {
    return []
  }
}

/**
 * Inserts master record into notas_fiscais.
 */
export async function insertNF(
  data: Partial<ParsedNFData> & { status?: 'importada' | 'revisada' | 'confirmada' },
): Promise<string> {
  // Validação prévia de campos obrigatórios no insert
  if (!data.numero_nf || !String(data.numero_nf).trim()) {
    throw new Error('Campo obrigatorio faltando: numero_nf')
  }
  if (!data.destinatario_nome || !String(data.destinatario_nome).trim()) {
    throw new Error('Campo obrigatorio faltando: destinatario_nome')
  }
  if (!data.data_emissao || !String(data.data_emissao).trim()) {
    throw new Error('Campo obrigatorio faltando: data_emissao')
  }

  const currentUserId = pb.authStore.model?.id
  if (!currentUserId) {
    throw new Error('Autenticação necessária')
  }

  try {
    // Format date string YYYY-MM-DD
    let formattedDate = data.data_emissao || ''
    if (formattedDate.includes('/')) {
      const p = formattedDate.split('/')
      if (p.length === 3) {
        formattedDate = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
      }
    }
    if (!formattedDate) {
      formattedDate = new Date().toISOString().substring(0, 10)
    }

    let faturaVenc = data.fatura_vencimento || ''
    if (faturaVenc && faturaVenc.includes('/')) {
      const pf = faturaVenc.split('/')
      if (pf.length === 3) {
        faturaVenc = `${pf[2]}-${pf[1].padStart(2, '0')}-${pf[0].padStart(2, '0')}`
      }
    }

    // Map canal_vendas to match notas_fiscais schema (Industria vs Indústria)
    let canalVendasClean: ParsedNFData['canal_vendas'] | null = data.canal_vendas || null
    if ((canalVendasClean as unknown) === 'Indústria') {
      canalVendasClean = 'Industria'
    } else if (canalVendasClean === ('' as unknown)) {
      canalVendasClean = null
    }

    const valTotalNotaNum =
      data.valor_total_nota === null ||
      data.valor_total_nota === undefined ||
      data.valor_total_nota === ('' as unknown)
        ? 0
        : normalizeNumberBR(data.valor_total_nota)

    const valProdutosNum =
      data.valor_total_produtos !== undefined && data.valor_total_produtos !== null
        ? normalizeNumberBR(data.valor_total_produtos)
        : valTotalNotaNum

    // Truncamento e sanitização defensiva para raw_text de auditoria
    let safeRawText = String(data.raw_text || '').trim()
    // Se o texto for corrompido ou sequência binária ilegível, omitir para manter limpo
    const hasCorruptPattern = /\b[A-Z][a-z][A-Z][a-z][A-Z][a-z]\b/.test(safeRawText)
    const isBinaryJunk =
      safeRawText.length > 100 &&
      safeRawText.replace(/[\u0020-\u007E\u00A0-\u00FF\n\r\t]/g, '').length / safeRawText.length >
        0.3
    if (hasCorruptPattern || isBinaryJunk) {
      safeRawText = ''
    } else if (safeRawText.length > 4000) {
      safeRawText = safeRawText.slice(0, 4000) + ' ...[texto truncado]'
    }

    const payload: Record<string, string | number | null> = {
      numero_nf: String(data.numero_nf || '').trim(),
      serie: String(data.serie || '1'),
      chave_acesso: String(data.chave_acesso || '').replace(/\s+/g, ''),
      data_emissao: formattedDate,
      natureza_operacao: String(data.natureza_operacao || 'S-Venda Mercadoria'),
      protocolo_autorizacao: String(data.protocolo_autorizacao || ''),
      destinatario_nome: String(data.destinatario_nome || '').trim(),
      destinatario_cnpj: String(data.destinatario_cnpj || ''),
      destinatario_ie: String(data.destinatario_ie || ''),
      destinatario_endereco: String(data.destinatario_endereco || ''),
      destinatario_bairro: String(data.destinatario_bairro || ''),
      destinatario_cep: String(data.destinatario_cep || ''),
      destinatario_municipio: String(data.destinatario_municipio || ''),
      destinatario_uf: String(data.destinatario_uf || '').toUpperCase(),
      destinatario_fone: String(data.destinatario_fone || ''),
      fatura_numero: String(data.fatura_numero || ''),
      fatura_vencimento: faturaVenc || null,
      fatura_valor: normalizeNumberBR(data.fatura_valor),
      bc_icms: normalizeNumberBR(data.bc_icms),
      valor_icms: normalizeNumberBR(data.valor_icms),
      valor_frete: normalizeNumberBR(data.valor_frete),
      valor_seguro: normalizeNumberBR(data.valor_seguro),
      desconto: normalizeNumberBR(data.desconto),
      outras_despesas: normalizeNumberBR(data.outras_despesas),
      valor_ipi: normalizeNumberBR(data.valor_ipi),
      valor_total_produtos: valProdutosNum,
      valor_total_nota: valTotalNotaNum,
      raw_text: safeRawText,
      frete_modalidade: data.frete_modalidade === 'FOB' ? 'FOB' : 'CIF',
      volumes_quantidade: normalizeNumberBR(data.volumes_quantidade),
      volumes_especie: String(data.volumes_especie || 'Paletes'),
      peso_bruto: normalizeNumberBR(data.peso_bruto),
      peso_liquido: normalizeNumberBR(data.peso_liquido),
      ordem_compra: String(data.ordem_compra || ''),
      valor_aproximado_tributos: normalizeNumberBR(data.valor_aproximado_tributos),
      especie_destino: data.especie_destino || null,
      canal_vendas: canalVendasClean || null,
      gestor_tecnico_id: data.gestor_tecnico_id || null,
      vendedor_id: data.vendedor_id || null,
      arquivo_pdf_url: data.arquivo_pdf_url || '',
      status: data.status || 'importada',
      user_id: currentUserId,
    }

    // Clean up null relation fields if empty to avoid PB validation rejections
    if (!payload.gestor_tecnico_id) delete payload.gestor_tecnico_id
    if (!payload.vendedor_id) delete payload.vendedor_id
    if (!payload.fatura_vencimento) delete payload.fatura_vencimento
    if (!payload.canal_vendas) delete payload.canal_vendas
    if (!payload.especie_destino) delete payload.especie_destino

    const record = await pb.collection('notas_fiscais').create<{ id: string }>(payload)
    return record.id
  } catch (err: unknown) {
    console.error('Erro ao inserir nota fiscal:', err)
    const errObj = err as any
    const responseData = errObj?.response?.data || errObj?.data?.data || errObj?.data
    let detailedFieldErrors = ''

    if (responseData && typeof responseData === 'object') {
      const fieldList: string[] = []
      for (const [key, val] of Object.entries(responseData)) {
        if (val && typeof val === 'object') {
          const msg = (val as any).message || (val as any).code || JSON.stringify(val)
          fieldList.push(`campo "${key}": ${msg}`)
        } else if (typeof val === 'string') {
          fieldList.push(`campo "${key}": ${val}`)
        }
      }
      if (fieldList.length > 0) {
        detailedFieldErrors = fieldList.join(', ')
      } else {
        detailedFieldErrors = JSON.stringify(responseData)
      }
    }

    const errorDetails = detailedFieldErrors || errObj?.message || ''
    const fullMsg = errorDetails
      ? `Erro ao gravar no banco de dados (${errorDetails}). Verifique os dados e tente novamente.`
      : 'Erro ao gravar no banco de dados. Verifique os dados e tente novamente.'
    throw new Error(fullMsg)
  }
}

/**
 * Inserts items into nf_itens.
 */
export async function insertItens(
  nfId: string,
  itens: ParsedItem[],
  valorTotalNotaFallback?: number | null,
): Promise<
  Array<{
    id: string
    produto_codigo: string
    lotes?: Array<{ lote_codigo: string; lote_quantidade: number }>
  }>
> {
  const currentUserId = pb.authStore.model?.id
  if (!currentUserId) {
    throw new Error('Autenticação necessária para gravar itens')
  }

  const insertedItens: Array<{
    id: string
    produto_codigo: string
    lotes?: Array<{ lote_codigo: string; lote_quantidade: number }>
  }> = []

  const itensList =
    itens && itens.length > 0
      ? itens
      : [
          {
            produto_codigo: 'BPMI.OR015',
            produto_descricao: 'Item da Nota Fiscal',
            produto_ncm: '2309.90.90',
            produto_cst: '100',
            produto_cfop: '6102',
            produto_unidade: 'KG',
            produto_quantidade: 1,
            produto_valor_unitario: valorTotalNotaFallback || 1,
            produto_valor_total: valorTotalNotaFallback || 1,
          } as ParsedItem,
        ]

  for (let idx = 0; idx < itensList.length; idx++) {
    const item = itensList[idx]
    let qtd = normalizeNumberBR(item.produto_quantidade)
    if (qtd <= 0) qtd = 1

    let unit = normalizeNumberBR(item.produto_valor_unitario)
    let tot = normalizeNumberBR(item.produto_valor_total)

    // Derivação segura e robusta dos valores obrigatórios:
    // 1. Se tem unitário mas não total: tot = qtd * unit
    if (tot <= 0 && unit > 0) {
      tot = Math.round(qtd * unit * 100) / 100
    }
    // 2. Se tem total mas não unitário: unit = tot / qtd
    else if (unit <= 0 && tot > 0) {
      unit = Math.round((tot / qtd) * 100) / 100
    }
    // 3. Se ambos vieram zerados ou em branco: rateio do valor_total_nota da NF
    else if (unit <= 0 && tot <= 0) {
      const nfTotal = valorTotalNotaFallback ? normalizeNumberBR(valorTotalNotaFallback) : 0
      if (nfTotal > 0) {
        if (itensList.length === 1) {
          tot = nfTotal
          unit = Math.round((tot / qtd) * 100) / 100
        } else {
          // Rateio igual se houver múltiplos itens sem valor
          tot = Math.round((nfTotal / itensList.length) * 100) / 100
          unit = Math.round((tot / qtd) * 100) / 100
        }
      }
    }

    // Se ainda assim os campos estiverem zerados ou negativos, garantir valor positivo padrão
    if (tot <= 0) tot = 1
    if (unit <= 0) unit = Math.round((tot / qtd) * 100) / 100 || 1

    const prodCod = String(item.produto_codigo || 'BPMI.OR015').trim() || 'BPMI.OR015'
    const prodDesc = String(item.produto_descricao || 'Produto').trim() || 'Produto'

    const payload = {
      nota_fiscal_id: nfId,
      produto_codigo: prodCod,
      produto_descricao: prodDesc,
      produto_ncm: String(item.produto_ncm || '2309.90.90').trim(),
      produto_cst: String(item.produto_cst || '100').trim(),
      produto_cfop: String(item.produto_cfop || '6102').trim(),
      produto_unidade: String(item.produto_unidade || 'KG')
        .trim()
        .toUpperCase(),
      produto_quantidade: qtd,
      produto_valor_unitario: unit,
      produto_valor_total: tot,
      bc_icms: normalizeNumberBR(item.bc_icms) || 0,
      valor_icms: normalizeNumberBR(item.valor_icms) || 0,
      valor_ipi: normalizeNumberBR(item.valor_ipi) || 0,
      aliq_icms: normalizeNumberBR(item.aliq_icms) || 0,
      aliq_ipi: normalizeNumberBR(item.aliq_ipi) || 0,
      user_id: currentUserId,
    }

    // Validação prévia no frontend antes de disparar create
    if (payload.produto_valor_unitario <= 0 || payload.produto_valor_total <= 0) {
      throw new Error(
        `Item ${idx + 1} (${prodCod}) possui valores inválidos (unitário ou total não podem ser vazios ou zerados).`,
      )
    }

    let rec: { id: string }
    try {
      rec = await pb.collection('nf_itens').create<{ id: string }>(payload)
    } catch (itErr) {
      console.error('Erro ao inserir item de NF:', itErr)
      const errObj = itErr as any
      const responseData = errObj?.response?.data || errObj?.data?.data || errObj?.data
      let detailedFieldErrors = ''
      if (responseData && typeof responseData === 'object') {
        const fieldList: string[] = []
        for (const [key, val] of Object.entries(responseData)) {
          if (val && typeof val === 'object') {
            const msg = (val as any).message || (val as any).code || JSON.stringify(val)
            fieldList.push(`campo "${key}": ${msg}`)
          } else if (typeof val === 'string') {
            fieldList.push(`campo "${key}": ${val}`)
          }
        }
        if (fieldList.length > 0) detailedFieldErrors = fieldList.join(', ')
      }
      const itErrDetails = detailedFieldErrors || errObj?.message || ''
      throw new Error(`Erro ao gravar item da nota fiscal (${itErrDetails}).`)
    }
    insertedItens.push({
      id: rec.id,
      produto_codigo: prodCod,
      lotes: item.lotes,
    })
  }

  return insertedItens
}

/**
 * Inserts lotes into nf_lotes.
 */
export async function insertLotes(
  nfId: string,
  itemId: string,
  lotes: Array<{ lote_codigo: string; lote_quantidade: number }>,
): Promise<void> {
  const currentUserId = pb.authStore.model?.id
  if (!lotes || lotes.length === 0) return

  for (const lot of lotes) {
    if (!lot.lote_codigo || !String(lot.lote_codigo).trim()) continue
    const lotQtd = normalizeNumberBR(lot.lote_quantidade)
    try {
      await pb.collection('nf_lotes').create({
        nota_fiscal_id: nfId,
        nf_item_id: itemId,
        lote_codigo: String(lot.lote_codigo).trim(),
        lote_quantidade: lotQtd,
        user_id: currentUserId,
      })
    } catch (lotErr) {
      console.warn('Erro ao inserir lote:', lotErr)
    }
  }
}

/**
 * Checks if a product code exists in the catalog.
 */
export async function checkCatalogProducts(): Promise<Set<string>> {
  try {
    const prods = await pb.collection('produtos').getFullList<{ codigo: string }>({
      fields: 'codigo',
    })
    return new Set(prods.map((p) => p.codigo.trim().toUpperCase()))
  } catch {
    return new Set()
  }
}

export interface CatalogProductInfo {
  codigo: string
  nome: string
  categoria?: string
  linha?: string
  preco_base?: number
}

export async function getCatalogProductsMap(): Promise<Map<string, CatalogProductInfo>> {
  try {
    const prods = await pb.collection('produtos').getFullList<CatalogProductInfo>({
      fields: 'codigo,nome,categoria,linha,preco_base',
    })
    const map = new Map<string, CatalogProductInfo>()
    for (const p of prods) {
      if (p.codigo) {
        map.set(p.codigo.trim().toUpperCase(), p)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

/**
 * Saves NF data with items and optional lotes (used as a high-level service call).
 */
export async function saveNF(
  data: Partial<ParsedNFData> & { status?: 'importada' | 'revisada' | 'confirmada' },
): Promise<string> {
  const nfId = await insertNF(data)
  const itensToSave = data.itens || []
  const inserted = await insertItens(nfId, itensToSave, data.valor_total_nota)
  for (const item of inserted) {
    if (item.lotes && item.lotes.length > 0) {
      await insertLotes(nfId, item.id, item.lotes)
    }
  }
  return nfId
}

export const nfService = {
  uploadToStorage,
  deleteFromStorage,
  callParseFunction,
  parseNF,
  getAtribuicao,
  getGestoresTecnicosEquipe,
  getVendedoresEquipe,
  insertNF,
  insertItens,
  insertLotes,
  saveNF,
  checkCatalogProducts,
  getCatalogProductsMap,
}

export default nfService
