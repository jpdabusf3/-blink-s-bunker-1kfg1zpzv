import pb from '@/lib/pocketbase/client'

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
  valor_total_nota: number
  valor_total_produtos?: number
  valor_aproximado_tributos?: number

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

    const record = await pb.collection('notas_fiscais_files').create(formData)
    const fileUrl = pb.files.getUrl(record, record.arquivo)
    return {
      url: fileUrl,
      fileRecordId: record.id,
    }
  } catch (err: any) {
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
    return res
  } catch (err: any) {
    console.error('Erro ao chamar parse-nf-pdf:', err)
    if (err?.status === 401) {
      throw new Error('Nao autorizado')
    }
    if (err?.data?.error) {
      throw new Error(err.data.error)
    }
    throw new Error('Erro ao extrair dados da NF. Verifique se o arquivo e um DANFE valido.')
  }
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
  try {
    const currentUserId = pb.authStore.model?.id
    if (!currentUserId) {
      throw new Error('Autenticação necessária')
    }

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

    const payload: Record<string, any> = {
      numero_nf: String(data.numero_nf || '').trim(),
      serie: String(data.serie || '1'),
      chave_acesso: String(data.chave_acesso || ''),
      data_emissao: formattedDate,
      natureza_operacao: String(data.natureza_operacao || 'Venda Mercadoria'),
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
      fatura_valor: Number(data.fatura_valor) || 0,
      bc_icms: Number(data.bc_icms) || 0,
      valor_icms: Number(data.valor_icms) || 0,
      valor_frete: Number(data.valor_frete) || 0,
      valor_seguro: Number(data.valor_seguro) || 0,
      desconto: Number(data.desconto) || 0,
      outras_despesas: Number(data.outras_despesas) || 0,
      valor_ipi: Number(data.valor_ipi) || 0,
      valor_total_produtos: Number(data.valor_total_produtos) || Number(data.valor_total_nota) || 0,
      valor_total_nota: Number(data.valor_total_nota) || 0,
      frete_modalidade: data.frete_modalidade === 'FOB' ? 'FOB' : 'CIF',
      volumes_quantidade: Number(data.volumes_quantidade) || 0,
      volumes_especie: String(data.volumes_especie || ''),
      peso_bruto: Number(data.peso_bruto) || 0,
      peso_liquido: Number(data.peso_liquido) || 0,
      ordem_compra: String(data.ordem_compra || ''),
      valor_aproximado_tributos: Number(data.valor_aproximado_tributos) || 0,
      especie_destino: data.especie_destino || null,
      canal_vendas: data.canal_vendas || null,
      gestor_tecnico_id: data.gestor_tecnico_id || null,
      vendedor_id: data.vendedor_id || null,
      arquivo_pdf_url: data.arquivo_pdf_url || '',
      status: data.status || 'importada',
      user_id: currentUserId,
    }

    const record = await pb.collection('notas_fiscais').create(payload)
    return record.id
  } catch (err: any) {
    console.error('Erro ao inserir nota fiscal:', err)
    throw err
  }
}

/**
 * Inserts items into nf_itens.
 */
export async function insertItens(
  nfId: string,
  itens: ParsedItem[],
): Promise<Array<{ id: string; produto_codigo: string; lotes?: any[] }>> {
  const currentUserId = pb.authStore.model?.id
  const insertedItens: Array<{ id: string; produto_codigo: string; lotes?: any[] }> = []

  for (const item of itens) {
    const payload = {
      nota_fiscal_id: nfId,
      produto_codigo: String(item.produto_codigo || 'ND'),
      produto_descricao: String(item.produto_descricao || ''),
      produto_ncm: String(item.produto_ncm || ''),
      produto_cst: String(item.produto_cst || ''),
      produto_cfop: String(item.produto_cfop || ''),
      produto_unidade: String(item.produto_unidade || 'KG'),
      produto_quantidade: Number(item.produto_quantidade) || 1,
      produto_valor_unitario: Number(item.produto_valor_unitario) || 0,
      produto_valor_total: Number(item.produto_valor_total) || 0,
      bc_icms: Number(item.bc_icms) || 0,
      valor_icms: Number(item.valor_icms) || 0,
      valor_ipi: Number(item.valor_ipi) || 0,
      aliq_icms: Number(item.aliq_icms) || 0,
      aliq_ipi: Number(item.aliq_ipi) || 0,
      user_id: currentUserId,
    }

    const rec = await pb.collection('nf_itens').create(payload)
    insertedItens.push({
      id: rec.id,
      produto_codigo: item.produto_codigo,
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
    if (!lot.lote_codigo) continue
    await pb.collection('nf_lotes').create({
      nota_fiscal_id: nfId,
      nf_item_id: itemId,
      lote_codigo: String(lot.lote_codigo),
      lote_quantidade: Number(lot.lote_quantidade) || 0,
      user_id: currentUserId,
    })
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
  linha?: string
  preco_base?: number
}

export async function getCatalogProductsMap(): Promise<Map<string, CatalogProductInfo>> {
  try {
    const prods = await pb.collection('produtos').getFullList<CatalogProductInfo>({
      fields: 'codigo,nome,linha,preco_base',
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

export const nfService = {
  uploadToStorage,
  deleteFromStorage,
  callParseFunction,
  getAtribuicao,
  getGestoresTecnicosEquipe,
  getVendedoresEquipe,
  insertNF,
  insertItens,
  insertLotes,
  checkCatalogProducts,
  getCatalogProductsMap,
}

export default nfService
