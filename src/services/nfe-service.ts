import pb from '@/lib/pocketbase/client'

export interface NfeItem {
  codigo: string
  nome: string
  ncm?: string
  cst?: string
  cfop?: string
  unidade?: string
  quantidade: number
  preco_unitario: number
  valor_total: number
  lote?: string
  produto_catalogo_id?: string | null
  produto_catalogo_nome?: string | null
  linha_produto?: string
  reconhecido?: boolean
  aliquota_icms?: number
  valor_icms?: number
  aliquota_pis?: number
  valor_pis?: number
  aliquota_cofins?: number
  valor_cofins?: number
}

export type NfeStatus =
  | 'pendente'
  | 'importada'
  | 'pendencia_produto'
  | 'aprovado'
  | 'rejeitado'
  | 'duplicada_ignorada'

export interface NfePedido {
  id: string
  // Dados da nota
  numero_nf: string
  serie_nf?: string
  chave_acesso?: string
  natureza_operacao?: string
  protocolo_autorizacao?: string
  data_emissao: string
  data_entrada_saida?: string
  hora_saida?: string

  // Emitente
  emitente_nome?: string
  emitente_cnpj?: string
  emitente_inscricao_estadual?: string
  emitente_endereco?: string

  // Destinatário / Cliente
  cliente_nome: string
  cliente_cnpj?: string
  cliente_municipio?: string
  cliente_cidade?: string
  cliente_uf?: string
  cliente_endereco?: string
  cliente_bairro_distrito?: string
  cliente_cep?: string
  cliente_inscricao_estadual?: string
  cliente_fone?: string

  factory_id?: string
  especie: string
  canal_vendas: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  itens: NfeItem[]

  // Impostos e valores
  base_calculo_icms?: number
  impostos_icms_base?: number
  aliquota_icms?: number
  impostos_icms_aliquota?: number
  valor_icms?: number
  impostos_icms_valor?: number
  base_calculo_icms_st?: number
  impostos_icms_st_base?: number
  valor_icms_st?: number
  impostos_icms_st_valor?: number
  valor_total_produtos?: number
  valor_produtos?: number
  valor_frete?: number
  frete_valor?: number
  frete_percentual?: number
  valor_seguro?: number
  desconto?: number
  outras_despesas?: number
  valor_ipi?: number
  impostos_ipi_valor?: number
  valor_total: number
  valor_total_nota?: number
  valor_aproximado_tributos?: number
  impostos_pis_aliquota?: number
  impostos_pis_valor?: number
  impostos_cofins_aliquota?: number
  impostos_cofins_valor?: number
  impostos_total?: number

  // Fatura / Duplicatas
  fatura_numero?: string
  fatura_vencimento?: string
  fatura_valor?: number

  // Frete / Transporte
  frete_modalidade?: string
  modalidade_frete?: string
  volumes?: string
  peso_bruto?: number
  peso_liquido?: number

  // Observações
  ordem_compra?: string
  observacoes?: string

  status: NfeStatus
  motivo_pendencia?: string
  aprovado_por?: string
  aprovado_em?: string
  arquivo_nome?: string
  raw_text?: string
  created: string
  updated: string
  expand?: {
    factory_id?: { id: string; name: string; city?: string; state?: string }
    gestor_tecnico_id?: { id: string; nome: string }
    vendedor_id?: { id: string; nome: string }
    aprovado_por?: { id: string; name: string }
    [key: string]: unknown
  }
  _sourceTable?: 'nfe_pedidos' | 'notas_fiscais'
}

export interface ProdutoCatalogo {
  id: string
  codigo: string
  nome: string
  nome_curto?: string
  familia?: string
  linha?: string
  especie_destino?: string
  unidade_medida?: string
  preco_base?: number
  especie_padrao?: string
  ativo: boolean
  user_id?: string
  created: string
  updated: string
}

export interface ProcessarNfeResultado {
  id?: string
  arquivo: string
  numero_nf?: string
  cliente?: string
  cnpj?: string
  valor?: number
  itens_count?: number
  status: string
  motivo_pendencia?: string
  mensagem: string
}

export interface ProcessarNfeResponse {
  success: boolean
  importados: number
  pendentes_revisao: number
  pendencias_produto: number
  duplicadas_ignoradas: number
  total: number
  resultados: ProcessarNfeResultado[]
}

export function isReadablePdfText(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  if (trimmed.length < 30) return false

  // Se houver excesso de sequências de corrupção binária tipo UMuMbMe
  const corruptMatches = trimmed.match(/\b[A-Z][a-z][A-Z][a-z][A-Z][a-z]\b/g)
  if (corruptMatches && corruptMatches.length > 5) return false

  // Deve conter palavras/termos típicos de NF ou letras normais legíveis
  const hasDanfeKeywords =
    /NOTA|FISCAL|DANFE|DESTINAT|EMISS|PRODUTO|VALOR|ICMS|CNPJ|CLIENTE|BLINK|NUTTRIA/i.test(trimmed)
  const hasReadableLettersAndNumbers = /[A-Za-z]{3,}/.test(trimmed) && /\d/.test(trimmed)

  return hasDanfeKeywords || hasReadableLettersAndNumbers
}

export async function extrairTextoPdf(file: File): Promise<string> {
  let extractionMethod = 'none'

  // Tentativa 1: pdfjs-dist via CDN dinâmico moderno (jsdelivr / esm.sh)
  const cdnUrls = [
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
    'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.mjs',
  ]

  for (const cdnUrl of cdnUrls) {
    try {
      const pdfjs: any = await import(/* @vite-ignore */ cdnUrl)
      if (pdfjs?.getDocument) {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`
        }
        const arrayBuffer = await file.arrayBuffer()

        let doc: any = null
        try {
          doc = await pdfjs.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/',
            disableFontFace: false,
          }).promise
        } catch {
          // Fallback doc
          doc = await pdfjs.getDocument({
            data: arrayBuffer,
            disableFontFace: true,
          }).promise
        }

        if (doc && doc.numPages) {
          const pages: string[] = []
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i)
            const content = await page.getTextContent()
            const text = content.items
              .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
              .join(' ')
            pages.push(text)
          }
          const fullText = pages.join('\n')
          if (isReadablePdfText(fullText)) {
            extractionMethod = `pdfjs-cdn (${doc.numPages} paginas)`
            console.log(
              `extrairTextoPdf: extraídos ${fullText.length} caracteres legíveis via ${extractionMethod}`,
            )
            return fullText
          }
        }
      }
    } catch (err) {
      console.warn(`Tentativa de extração via ${cdnUrl} falhou:`, err)
    }
  }

  // Se não foi possível obter texto legível pelo browser, retornar string vazia
  // para que o servidor PocketBase processe o arquivo diretamente via pdf_url e IA
  console.info(
    '[extrairTextoPdf] Extração local não obteve texto limpo/legível. Deixando o processamento para o backend via pdf_url.',
  )
  return ''
}

export async function processarNfePdfs(
  arquivos: Array<{ nome: string; texto: string }>,
): Promise<ProcessarNfeResponse> {
  return pb.send('/backend/v1/nfe/processar-pdf', {
    method: 'POST',
    body: JSON.stringify({ arquivos }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function processarNfeExcel(
  rows: Record<string, unknown>[],
): Promise<ProcessarNfeResponse> {
  return pb.send('/backend/v1/nfe/processar-pdf', {
    method: 'POST',
    body: JSON.stringify({ excelRows: rows }),
    headers: { 'Content-Type': 'application/json' },
  })
}

interface NotaFiscalRecord {
  id: string
  numero_nf?: string
  serie?: string
  chave_acesso?: string
  data_emissao?: string
  natureza_operacao?: string
  protocolo_autorizacao?: string
  destinatario_nome?: string
  destinatario_cnpj?: string
  destinatario_ie?: string
  destinatario_endereco?: string
  destinatario_bairro?: string
  destinatario_cep?: string
  destinatario_municipio?: string
  destinatario_uf?: string
  destinatario_fone?: string
  fatura_numero?: string
  fatura_vencimento?: string
  fatura_valor?: number
  bc_icms?: number
  valor_icms?: number
  valor_frete?: number
  valor_seguro?: number
  desconto?: number
  outras_despesas?: number
  valor_ipi?: number
  valor_total_produtos?: number
  valor_total_nota?: number
  frete_modalidade?: string
  volumes_quantidade?: number
  volumes_especie?: string
  peso_bruto?: number
  peso_liquido?: number
  ordem_compra?: string
  valor_aproximado_tributos?: number
  especie_destino?: string
  canal_vendas?: string
  gestor_tecnico_id?: string
  vendedor_id?: string
  arquivo_pdf_url?: string
  status?: string
  user_id?: string
  created?: string
  updated?: string
  raw_text?: string
  expand?: {
    gestor_tecnico_id?: { id: string; nome?: string }
    vendedor_id?: { id: string; nome?: string }
    [key: string]: unknown
  }
}

interface NfItemRecord {
  id: string
  nota_fiscal_id: string
  produto_codigo?: string
  produto_descricao?: string
  produto_ncm?: string
  produto_cst?: string
  produto_cfop?: string
  produto_unidade?: string
  produto_quantidade?: number
  produto_valor_unitario?: number
  produto_valor_total?: number
  bc_icms?: number
  valor_icms?: number
  valor_ipi?: number
  aliq_icms?: number
  aliq_ipi?: number
}

function mapNotaFiscalToNfePedido(
  nf: NotaFiscalRecord,
  itemsByNfId: Map<string, NfItemRecord[]>,
  catalogCodes: Set<string>,
): NfePedido {
  const rawItems = itemsByNfId.get(nf.id) || []
  let hasPendingProduct = false

  const mappedItens: NfeItem[] = rawItems.map((item) => {
    const rawCod = (item.produto_codigo || '').trim().toUpperCase()
    const isND = !rawCod || rawCod === 'ND'
    const isKnown = !isND && catalogCodes.has(rawCod)

    if (!isND && !isKnown) {
      hasPendingProduct = true
    }

    return {
      codigo: item.produto_codigo || '',
      nome: item.produto_descricao || 'Produto sem descrição',
      ncm: item.produto_ncm || undefined,
      cst: item.produto_cst || undefined,
      cfop: item.produto_cfop || undefined,
      unidade: item.produto_unidade || 'KG',
      quantidade: Number(item.produto_quantidade) || 0,
      preco_unitario: Number(item.produto_valor_unitario) || 0,
      valor_total: Number(item.produto_valor_total) || 0,
      aliquota_icms: item.aliq_icms !== undefined ? Number(item.aliq_icms) : undefined,
      valor_icms: item.valor_icms !== undefined ? Number(item.valor_icms) : undefined,
      reconhecido: isKnown,
    }
  })

  // Mapeamento de status:
  // Se nf.status é 'confirmada' -> 'aprovado'
  // Se nf.status é 'importada' ou 'pendente':
  //   - Se há itens não catalogados -> 'pendencia_produto'
  //   - Caso contrário -> 'pendente'
  let mappedStatus: NfeStatus = 'pendente'
  if (nf.status === 'confirmada' || nf.status === 'revisada') {
    mappedStatus = 'aprovado'
  } else if (hasPendingProduct) {
    mappedStatus = 'pendencia_produto'
  } else {
    mappedStatus = 'pendente'
  }

  const valorTotal =
    Number(nf.valor_total_nota) ||
    Number(nf.valor_total_produtos) ||
    mappedItens.reduce((sum, it) => sum + (it.valor_total || 0), 0)

  // Extrair nome do arquivo do URL se existir
  let arquivoNome: string | undefined
  if (nf.arquivo_pdf_url) {
    try {
      const parts = nf.arquivo_pdf_url.split('/')
      arquivoNome = decodeURIComponent(parts[parts.length - 1] || '')
    } catch {
      arquivoNome = undefined
    }
  }

  const gestorNome = nf.expand?.gestor_tecnico_id?.nome
  const vendedorNome = nf.expand?.vendedor_id?.nome

  return {
    id: nf.id,
    _sourceTable: 'notas_fiscais',
    numero_nf: nf.numero_nf || 'S/N',
    serie_nf: nf.serie || '1',
    chave_acesso: nf.chave_acesso || undefined,
    natureza_operacao: nf.natureza_operacao || undefined,
    protocolo_autorizacao: nf.protocolo_autorizacao || undefined,
    data_emissao: nf.data_emissao || nf.created || new Date().toISOString(),

    cliente_nome: nf.destinatario_nome?.trim() || 'Sem Razão Social',
    cliente_cnpj: nf.destinatario_cnpj || undefined,
    cliente_municipio: nf.destinatario_municipio || undefined,
    cliente_cidade: nf.destinatario_municipio || undefined,
    cliente_uf: nf.destinatario_uf || undefined,
    cliente_endereco: nf.destinatario_endereco || undefined,
    cliente_bairro_distrito: nf.destinatario_bairro || undefined,
    cliente_cep: nf.destinatario_cep || undefined,
    cliente_inscricao_estadual: nf.destinatario_ie || undefined,
    cliente_fone: nf.destinatario_fone || undefined,

    especie: nf.especie_destino || 'BOVINO',
    canal_vendas: nf.canal_vendas || 'Direto',
    gestor_tecnico_id: nf.gestor_tecnico_id || undefined,
    vendedor_id: nf.vendedor_id || undefined,
    itens: mappedItens,

    base_calculo_icms: nf.bc_icms !== undefined ? Number(nf.bc_icms) : undefined,
    valor_icms: nf.valor_icms !== undefined ? Number(nf.valor_icms) : undefined,
    valor_total_produtos:
      nf.valor_total_produtos !== undefined ? Number(nf.valor_total_produtos) : undefined,
    valor_frete: nf.valor_frete !== undefined ? Number(nf.valor_frete) : undefined,
    frete_valor: nf.valor_frete !== undefined ? Number(nf.valor_frete) : undefined,
    valor_seguro: nf.valor_seguro !== undefined ? Number(nf.valor_seguro) : undefined,
    desconto: nf.desconto !== undefined ? Number(nf.desconto) : undefined,
    outras_despesas: nf.outras_despesas !== undefined ? Number(nf.outras_despesas) : undefined,
    valor_ipi: nf.valor_ipi !== undefined ? Number(nf.valor_ipi) : undefined,
    valor_total: valorTotal,
    valor_total_nota: Number(nf.valor_total_nota) || valorTotal,
    valor_aproximado_tributos:
      nf.valor_aproximado_tributos !== undefined ? Number(nf.valor_aproximado_tributos) : undefined,

    fatura_numero: nf.fatura_numero || undefined,
    fatura_vencimento: nf.fatura_vencimento || undefined,
    fatura_valor: nf.fatura_valor !== undefined ? Number(nf.fatura_valor) : undefined,

    frete_modalidade: nf.frete_modalidade || 'CIF',
    modalidade_frete: nf.frete_modalidade || 'CIF',
    volumes:
      nf.volumes_quantidade || nf.volumes_especie
        ? `${nf.volumes_quantidade || ''} ${nf.volumes_especie || ''}`.trim()
        : undefined,
    peso_bruto: nf.peso_bruto !== undefined ? Number(nf.peso_bruto) : undefined,
    peso_liquido: nf.peso_liquido !== undefined ? Number(nf.peso_liquido) : undefined,
    ordem_compra: nf.ordem_compra || undefined,

    status: mappedStatus,
    motivo_pendencia: hasPendingProduct
      ? 'Itens não vinculados ao catálogo de produtos'
      : undefined,
    arquivo_nome: arquivoNome,
    raw_text: nf.raw_text || undefined,
    created: nf.created || new Date().toISOString(),
    updated: nf.updated || new Date().toISOString(),

    expand: {
      gestor_tecnico_id: gestorNome
        ? { id: nf.gestor_tecnico_id || '', nome: gestorNome }
        : undefined,
      vendedor_id: vendedorNome ? { id: nf.vendedor_id || '', nome: vendedorNome } : undefined,
    },
  }
}

export async function getNfePedidos(status?: NfeStatus | 'all'): Promise<NfePedido[]> {
  // 1. Buscar nfe_pedidos com tratamento resiliente
  const nfePedidosPromise = (async () => {
    try {
      const filter = status && status !== 'all' ? `status = "${status}"` : ''
      const res = await pb.collection('nfe_pedidos').getFullList<NfePedido>({
        filter,
        sort: '-created',
        expand: 'factory_id,gestor_tecnico_id,vendedor_id,aprovado_por',
      })
      return res.map((r) => ({ ...r, _sourceTable: 'nfe_pedidos' as const }))
    } catch (err) {
      console.warn('[getNfePedidos] Falha ao consultar nfe_pedidos:', err)
      return [] as NfePedido[]
    }
  })()

  // 2. Buscar notas_fiscais + nf_itens + catálogo com tratamento resiliente
  const notasFiscaisPromise = (async () => {
    try {
      // Montar filtro de notas_fiscais de acordo com o status solicitado
      let nfFilter = ''
      if (status === 'pendente' || status === 'pendencia_produto') {
        nfFilter = 'status="importada" || status="pendente"'
      } else if (status === 'aprovado') {
        nfFilter = 'status="confirmada" || status="revisada"'
      } else if (status && status !== 'all') {
        nfFilter = `status="${status}"`
      }

      const [nfRecords, allItens, prods] = await Promise.all([
        pb
          .collection('notas_fiscais')
          .getFullList<NotaFiscalRecord>({
            filter: nfFilter,
            sort: '-created',
            expand: 'gestor_tecnico_id,vendedor_id',
          })
          .catch((err) => {
            console.warn('[getNfePedidos] Falha ao buscar notas_fiscais:', err)
            return [] as NotaFiscalRecord[]
          }),
        pb
          .collection('nf_itens')
          .getFullList<NfItemRecord>({
            sort: 'created',
          })
          .catch((err) => {
            console.warn('[getNfePedidos] Falha ao buscar nf_itens:', err)
            return [] as NfItemRecord[]
          }),
        pb
          .collection('produtos')
          .getFullList<{ codigo?: string }>({
            fields: 'codigo',
          })
          .catch(() => [] as Array<{ codigo?: string }>),
      ])

      const catalogCodes = new Set(
        prods.map((p) => (p.codigo || '').trim().toUpperCase()).filter(Boolean),
      )

      // Agrupar itens por nota_fiscal_id
      const itemsByNfId = new Map<string, NfItemRecord[]>()
      for (const it of allItens) {
        if (!it.nota_fiscal_id) continue
        const list = itemsByNfId.get(it.nota_fiscal_id) || []
        list.push(it)
        itemsByNfId.set(it.nota_fiscal_id, list)
      }

      return nfRecords.map((nf) => mapNotaFiscalToNfePedido(nf, itemsByNfId, catalogCodes))
    } catch (err) {
      console.warn('[getNfePedidos] Falha ao unificar notas_fiscais:', err)
      return [] as NfePedido[]
    }
  })()

  const [fromNfePedidos, fromNotasFiscais] = await Promise.all([
    nfePedidosPromise,
    notasFiscaisPromise,
  ])

  // Desduplicar caso o mesmo id ou numero_nf exista em ambos (preferir nfe_pedidos se houver)
  const seenIds = new Set<string>()
  const combined: NfePedido[] = []

  for (const p of fromNfePedidos) {
    seenIds.add(p.id)
    combined.push(p)
  }

  for (const p of fromNotasFiscais) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id)
      // Se filtramos por status específico, aplicar na saída mapeada
      if (!status || status === 'all' || p.status === status) {
        combined.push(p)
      }
    }
  }

  // Ordenar decrescente pela data de emissão / criação
  combined.sort((a, b) => {
    const timeA = new Date(a.data_emissao || a.created).getTime() || 0
    const timeB = new Date(b.data_emissao || b.created).getTime() || 0
    return timeB - timeA
  })

  return combined
}

export async function getNfePedidoById(id: string): Promise<NfePedido> {
  // Tentar primeiro em nfe_pedidos
  try {
    const res = await pb.collection('nfe_pedidos').getOne<NfePedido>(id, {
      expand: 'factory_id,gestor_tecnico_id,vendedor_id,aprovado_por',
    })
    return { ...res, _sourceTable: 'nfe_pedidos' }
  } catch {
    // Fallback: tentar em notas_fiscais
    const [nf, items, prods] = await Promise.all([
      pb.collection('notas_fiscais').getOne<NotaFiscalRecord>(id, {
        expand: 'gestor_tecnico_id,vendedor_id',
      }),
      pb
        .collection('nf_itens')
        .getFullList<NfItemRecord>({
          filter: `nota_fiscal_id="${id}"`,
        })
        .catch(() => [] as NfItemRecord[]),
      pb
        .collection('produtos')
        .getFullList<{ codigo?: string }>({
          fields: 'codigo',
        })
        .catch(() => [] as Array<{ codigo?: string }>),
    ])

    const catalogCodes = new Set(
      prods.map((p) => (p.codigo || '').trim().toUpperCase()).filter(Boolean),
    )
    const map = new Map<string, NfItemRecord[]>([[id, items]])
    return mapNotaFiscalToNfePedido(nf, map, catalogCodes)
  }
}

export async function aprovarNfePedido(
  id: string,
  dadosEditados?: Partial<NfePedido>,
): Promise<{ success: boolean; nfe_id: string; venda_id: string; mensagem: string }> {
  // 1. Tentar endpoint customizado /backend/v1/nfe/aprovar se existir
  try {
    const res = await pb.send('/backend/v1/nfe/aprovar', {
      method: 'POST',
      body: JSON.stringify({ id, dados: dadosEditados }),
      headers: { 'Content-Type': 'application/json' },
    })
    return res
  } catch (backendErr) {
    console.info(
      '[aprovarNfePedido] Endpoint /backend/v1/nfe/aprovar não disponível ou falhou, executando aprovação direta no banco:',
      backendErr,
    )
  }

  // 2. Aprovação direta e resiliente suportando tanto 'nfe_pedidos' quanto 'notas_fiscais'
  // Identificar se o registro está em nfe_pedidos ou notas_fiscais
  let isNotasFiscais = false
  try {
    await pb.collection('notas_fiscais').getOne(id)
    isNotasFiscais = true
  } catch {
    isNotasFiscais = false
  }

  const currentUser = pb.authStore.model

  if (isNotasFiscais) {
    // Atualizar status na coleção notas_fiscais para 'confirmada'
    const updatePayload: Record<string, unknown> = {
      status: 'confirmada',
    }
    if (dadosEditados?.cliente_nome) updatePayload.destinatario_nome = dadosEditados.cliente_nome
    if (dadosEditados?.cliente_cnpj) updatePayload.destinatario_cnpj = dadosEditados.cliente_cnpj
    if (dadosEditados?.numero_nf) updatePayload.numero_nf = dadosEditados.numero_nf
    if (dadosEditados?.data_emissao) updatePayload.data_emissao = dadosEditados.data_emissao
    if (dadosEditados?.especie) updatePayload.especie_destino = dadosEditados.especie
    if (dadosEditados?.canal_vendas) updatePayload.canal_vendas = dadosEditados.canal_vendas
    if (dadosEditados?.vendedor_id) updatePayload.vendedor_id = dadosEditados.vendedor_id
    if (dadosEditados?.valor_total) updatePayload.valor_total_nota = dadosEditados.valor_total

    await pb.collection('notas_fiscais').update(id, updatePayload)

    // Se já existem registros em historico_vendas criados na importação, atualizar status
    try {
      const hvList = await pb.collection('historico_vendas').getFullList<{ id: string }>({
        filter: `numero_documento="${dadosEditados?.numero_nf || ''}"`,
      })
      for (const hv of hvList) {
        await pb.collection('historico_vendas').update(hv.id, { status: 'realizado' })
      }
    } catch {
      // Ignorar se não encontrar em historico_vendas
    }

    return {
      success: true,
      nfe_id: id,
      venda_id: id,
      mensagem: 'Nota fiscal aprovada e confirmada com sucesso.',
    }
  } else {
    // Atualizar na coleção nfe_pedidos
    const updatePayload: Partial<NfePedido> = {
      ...dadosEditados,
      status: 'aprovado',
      aprovado_por: currentUser?.id,
      aprovado_em: new Date().toISOString(),
    }
    const updated = await pb.collection('nfe_pedidos').update<NfePedido>(id, updatePayload)
    return {
      success: true,
      nfe_id: updated.id,
      venda_id: updated.id,
      mensagem: 'Pedido de NF-e aprovado com sucesso.',
    }
  }
}

export async function rejeitarNfePedido(
  id: string,
  motivo?: string,
): Promise<{ success: boolean; nfe_id: string; mensagem: string }> {
  // 1. Tentar endpoint customizado /backend/v1/nfe/rejeitar se existir
  try {
    const res = await pb.send('/backend/v1/nfe/rejeitar', {
      method: 'POST',
      body: JSON.stringify({ id, motivo }),
      headers: { 'Content-Type': 'application/json' },
    })
    return res
  } catch (backendErr) {
    console.info(
      '[rejeitarNfePedido] Endpoint /backend/v1/nfe/rejeitar não disponível, executando rejeição direta no banco:',
      backendErr,
    )
  }

  // 2. Rejeição direta no banco
  let isNotasFiscais = false
  try {
    await pb.collection('notas_fiscais').getOne(id)
    isNotasFiscais = true
  } catch {
    isNotasFiscais = false
  }

  if (isNotasFiscais) {
    // Remover ou alterar status
    await pb.collection('notas_fiscais').delete(id)
    return {
      success: true,
      nfe_id: id,
      mensagem: 'Nota fiscal rejeitada e removida da fila.',
    }
  } else {
    await pb.collection('nfe_pedidos').update(id, {
      status: 'rejeitado',
      motivo_pendencia: motivo || 'Rejeitado pelo usuário',
    })
    return {
      success: true,
      nfe_id: id,
      mensagem: 'Pedido de NF-e rejeitado.',
    }
  }
}

export async function excluirNfePedido(id: string): Promise<boolean> {
  try {
    await pb.collection('nfe_pedidos').delete(id)
    return true
  } catch {
    try {
      await pb.collection('notas_fiscais').delete(id)
      return true
    } catch (err) {
      console.error('[excluirNfePedido] Erro ao excluir:', err)
      return false
    }
  }
}

export async function atualizarNfePedido(
  id: string,
  dados: Partial<NfePedido>,
): Promise<NfePedido> {
  try {
    return await pb.collection('nfe_pedidos').update<NfePedido>(id, dados)
  } catch {
    // Se estiver em notas_fiscais
    const nfPayload: Record<string, unknown> = {}
    if (dados.cliente_nome) nfPayload.destinatario_nome = dados.cliente_nome
    if (dados.cliente_cnpj) nfPayload.destinatario_cnpj = dados.cliente_cnpj
    if (dados.cliente_cidade) nfPayload.destinatario_municipio = dados.cliente_cidade
    if (dados.cliente_uf) nfPayload.destinatario_uf = dados.cliente_uf
    if (dados.numero_nf) nfPayload.numero_nf = dados.numero_nf
    if (dados.data_emissao) nfPayload.data_emissao = dados.data_emissao
    if (dados.especie) nfPayload.especie_destino = dados.especie
    if (dados.canal_vendas) nfPayload.canal_vendas = dados.canal_vendas
    if (dados.vendedor_id) nfPayload.vendedor_id = dados.vendedor_id
    if (dados.valor_total) nfPayload.valor_total_nota = dados.valor_total

    await pb.collection('notas_fiscais').update(id, nfPayload)
    return getNfePedidoById(id)
  }
}

export async function getProdutosCatalogo(): Promise<ProdutoCatalogo[]> {
  return pb.collection('produtos').getFullList<ProdutoCatalogo>({
    filter: 'ativo = true',
    sort: 'linha,nome',
  })
}

export async function createProdutoCatalogo(
  dados: Partial<ProdutoCatalogo>,
): Promise<ProdutoCatalogo> {
  return pb.collection('produtos').create<ProdutoCatalogo>(dados)
}

export function downloadModeloNfeExcel(): void {
  import('xlsx').then((XLSX) => {
    const template = [
      {
        // Dados da Nota
        chave_acesso: '4126 0838 3486 3800 0433 5500 1000 0003 2216 4814 4744',
        numero_nf: '322',
        serie: '1',
        natureza_operacao: 'S-Venda Mercadoria',
        protocolo_autorizacao: '141260348963840 - 31/08/2026 19:09:42',
        data_emissao: '31/08/2026',
        data_entrada_saida: '31/08/2026',
        hora_saida: '19:09:00',

        // Emitente
        emitente_razao_social: 'BLINK BIOSCIENCE BRASIL LTDA.',
        emitente_cnpj: '38.348.638/0004-33',
        emitente_inscricao_estadual: '9118131816',
        emitente_endereco:
          'Avenida Melvim Jones, 440 - Lte 211 - Parque Industrial Bandeirantes, Maringa - PR, CEP 87.070-030',

        // Destinatário/Cliente
        cliente_razao_social: 'Nuttria Nutricao Animal Ltda.',
        cliente_cnpj: '29.133.749/0001-99',
        cliente_municipio: 'Mirassol',
        cliente_uf: 'SP',
        cliente_endereco: 'RUA Feliciano Sales Cunha, Km 455',
        cliente_bairro_distrito: 'Zona Rural',
        cliente_cep: '15.138-899',
        cliente_inscricao_estadual: '1735200800',
        cliente_fone: '451086290112',

        // Impostos e valores
        base_calculo_icms: 9000.0,
        valor_icms: 360.0,
        aliquota_icms: 4.0,
        base_calculo_icms_st: 0.0,
        valor_icms_st: 0.0,
        valor_total_produtos: 8550.0,
        valor_frete: 450.0,
        valor_seguro: 0.0,
        desconto: 0.0,
        outras_despesas: 0.0,
        valor_ipi: 0.0,
        valor_total_nota: 9000.0,
        valor_aproximado_tributos: 360.0,

        // Fatura/Duplicatas
        fatura_numero: '001',
        fatura_vencimento: '28/09/2026',
        fatura_valor: 9000.0,

        // Frete/Transporte
        modalidade_frete: 'CIF',
        volumes: '1 palete',
        peso_bruto: 335.0,
        peso_liquido: 300.0,

        // Itens de produto
        codigo_produto: 'BPMI.OR015',
        descricao_produto: 'Blink Copper 22 - SC',
        ncm: '2309.90.90',
        cst: '100',
        cfop: '6102',
        unidade: 'KG',
        quantidade: 300.0,
        valor_unitario: 28.5,
        valor_total_item: 8550.0,
        lote: 'B2026012002MIOR.Cu22 Qtde: 300,00',

        // Observações
        ordem_compra: 'ORDEM DE COMPRA 15040',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo NF-e Padrão')
    XLSX.writeFile(wb, 'modelo_nota_fiscal_padrao_nfe.xlsx')
  })
}
