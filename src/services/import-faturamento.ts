import * as XLSX from 'xlsx'
import pb from '@/lib/pocketbase/client'

export type FaturamentoFieldKey =
  | 'data'
  | 'numero_documento'
  | 'cliente'
  | 'cnpj'
  | 'produto'
  | 'produto_codigo'
  | 'especie'
  | 'quantidade'
  | 'valor_usd'
  | 'valor_unitario_usd'
  | 'valor_total_nota_usd'
  | 'valor'
  | 'valor_unitario'
  | 'valor_total_nota'
  | 'vendedor'
  | 'gestor'
  | 'unidade'
  | 'canal_vendas'
  | 'status'
  | 'familia_produto'
  | 'country'

export interface FieldDefinition {
  key: FaturamentoFieldKey
  label: string
  required: boolean
  description: string
  aliases: string[]
}

export const FATURAMENTO_FIELDS: FieldDefinition[] = [
  {
    key: 'data',
    label: 'Data (Mês/Ano ou Faturamento)',
    required: true,
    description: 'Mês/Ano ou data de faturamento (ex: Jan/2025, 01/2025, 10/01/2025)',
    aliases: [
      'data',
      'dt',
      'data_faturamento',
      'data_emissao',
      'data_pedido',
      'dt_faturamento',
      'dt_emissao',
      'dt_venda',
      'data_doc',
      'data_documento',
      'data faturamento',
      'data faturado',
      'faturado em',
      'emissao',
      'periodo',
      'mes',
      'mes_ano',
      'mes ano',
      'mes/ano',
      'mes_referencia',
      'ano_mes',
      'ano',
      'competencia',
      'docdate',
      'doc_date',
      'doc date',
      // Termos em inglês comumente presentes em planilhas de ERP/BI
      'date',
      'month/year',
      'month-year',
      'month year',
      'invoice_date',
      'order_date',
      'billing_date',
      'month',
      'month_year',
      'period',
    ],
  },
  {
    key: 'cliente',
    label: 'Cliente (Código & Razão Social)',
    required: true,
    description: 'Nome e/ou código cadastral do cliente (ex: 1234 - Master Premix Nutrição Ltda)',
    aliases: [
      'cliente',
      'nome',
      'destinatario',
      'razao_social',
      'razao social',
      'nome_fantasia',
      'nome fantasia',
      'cliente_nome',
      'destinatario_nome',
      'comprador',
      'parceiro',
      'conta',
      'cliente_cod_descricao',
      'cliente cod descricao',
      'cliente - cod. & descricao',
      'cliente - cod & descricao',
      'cliente cod & descricao',
      'cod & descricao',
      'cod e descricao',
      'cliente descricao',
      'cliente / razao',
      'codigo e cliente',
      'codigo cliente',
      // Termos em inglês
      'customer',
      'client',
      'customer_name',
      'client_name',
      'customer/client',
      'customer name',
      'client name',
      'account',
      'buyer',
    ],
  },
  {
    key: 'cnpj',
    label: 'CNPJ do Cliente',
    required: false,
    description: 'CNPJ para vinculação prioritária e unívoca com o cadastro de Clientes',
    aliases: [
      'cnpj',
      'cpf_cnpj',
      'cnpj_cpf',
      'documento',
      'cnpj_cliente',
      'cnpj cliente',
      'doc_cliente',
      'c.g.c.',
      'cgc',
      // Termos em inglês
      'tax_id',
      'vat',
      'tax_number',
      'registration_number',
    ],
  },
  {
    key: 'numero_documento',
    label: 'NF / Número do Documento',
    required: false,
    description: 'Número da nota fiscal ou pedido (usado para idempotência/evitar duplicatas)',
    aliases: [
      'nf',
      'nota',
      'nota_fiscal',
      'nota fiscal',
      'num_nf',
      'numero_nf',
      'numero',
      'nro_nf',
      'pedido',
      'numero_pedido',
      'num_pedido',
      'num_doc',
      'documento_numero',
      'numero_documento',
      'n doc',
      'n nf',
      'chave',
      'numero_doc',
      'n_documento',
      'nf_ano',
      'nf ano',
      'nf_ano_mes',
      'nf ano mes',
      // Termos em inglês
      'invoice',
      'invoice_number',
      'invoice_no',
      'document',
      'doc_number',
      'order_number',
      'order_no',
    ],
  },
  {
    key: 'valor_usd',
    label: 'Valor Total (USD $)',
    required: false,
    description: 'Valor total faturado em Dólar americano (base de faturamento principal)',
    aliases: [
      'amount',
      'amount_usd',
      'amount usd',
      'value_usd',
      'value usd',
      'valor_usd',
      'valor usd',
      'usd',
      'us$',
      'u$',
      'total_usd',
      'total usd',
      'faturamento_usd',
      'faturamento usd',
      'valor_total_usd',
      'valor total usd',
      'faturado_usd',
      'faturado usd',
      'faturamento_dolar',
      'faturamento dolar',
      'valor_dolar',
      'valor dolar',
      'total_dolar',
      'total dolar',
      'sales_usd',
      'revenue_usd',
      'total_amount_usd',
      'price_usd',
      'usd_amount',
      'usd_total',
      'usd_value',
      'dolar',
      'dollar',
      'vlr_usd',
      'vl_usd',
      'soma_de_vlr_total_usd',
      'soma de vlr total usd',
      'soma vlr total usd',
      'vlr_total_usd',
      'vlr total usd',
    ],
  },
  {
    key: 'valor',
    label: 'Valor Total (R$)',
    required: false,
    description: 'Valor total faturado em Real brasileiro (R$)',
    aliases: [
      'valor',
      'valor_brl',
      'valor brl',
      'valor_r$',
      'valor r$',
      'valor_rs',
      'valor rs',
      'r$',
      'rs',
      'brl',
      'total',
      'total_r$',
      'total r$',
      'total_rs',
      'total rs',
      'total_brl',
      'total brl',
      'valor_total',
      'valor total',
      'vl_total',
      'vlr_total',
      'faturamento',
      'faturamento_r$',
      'faturamento r$',
      'faturamento_rs',
      'faturamento rs',
      'faturamento_brl',
      'faturamento brl',
      'faturado',
      'valor_faturado',
      'valor faturado',
      'total_item',
      'valor_item',
      'produto_valor_total',
      'valor_liquido',
      'liquido',
      // Termos em inglês comumente associados a valor quando não indicado usd
      'value',
      'total_amount',
      'total_value',
      'revenue',
      'sales_value',
      'price_total',
      'soma_de_vlr_total_brl',
      'soma de vlr total brl',
      'soma vlr total brl',
      'vlr_total_brl',
      'vlr total brl',
      'soma_de_vlr_total',
      'soma de vlr total',
    ],
  },
  {
    key: 'valor_unitario_usd',
    label: 'Valor Unitário (USD $)',
    required: false,
    description: 'Preço unitário em Dólar por kg, saca ou unidade',
    aliases: [
      'unit_price_usd',
      'unit price usd',
      'unit_value_usd',
      'price_usd_unit',
      'valor_unitario_usd',
      'valor unitario usd',
      'preco_unitario_usd',
      'preco unitario usd',
      'vl_unit_usd',
      'vlr_unit_usd',
      'unitario_usd',
      'unitario usd',
    ],
  },
  {
    key: 'produto',
    label: 'Produto / Descrição',
    required: false,
    description: 'Descrição do produto vendido (ex: Blink Zinc 22)',
    aliases: [
      'produto',
      'descricao',
      'item',
      'produto_descricao',
      'descricao_produto',
      'mercadoria',
      'material',
      'nome_produto',
      'produto_nome',
      // Termos em inglês
      'product',
      'product_name',
      'description',
      'product_description',
      'item_description',
      'item_codigo_descricao',
      'item cod descricao',
      'item - cod. & descricao',
      'item - cod & descricao',
      'item cod & descricao',
    ],
  },
  {
    key: 'produto_codigo',
    label: 'Código do Produto / SKU',
    required: false,
    description: 'Código de catálogo ou ERP (ex: BPMI.OR035)',
    aliases: [
      'codigo',
      'cod_produto',
      'codigo_produto',
      'sku',
      'referencia',
      'cod_item',
      'produto_codigo',
      'part_number',
      // Termos em inglês
      'product_code',
      'item_code',
      'code',
    ],
  },
  {
    key: 'especie',
    label: 'Espécie Animal / Segmento',
    required: false,
    description: 'Aves, Suinos, Ruminantes, Pet, Aqua, Outros, etc.',
    aliases: [
      'especie',
      'especie_destino',
      'segmento',
      'carteira',
      'categoria_animal',
      'animal',
      'animaispecies',
      'setor',
      'familia_de_produtos',
      'familia de produtos',
      'familia_produto',
      'familia produtos',
      'familia',
      // Termos em inglês
      'species',
      'animal_species',
      'segment',
    ],
  },
  {
    key: 'quantidade',
    label: 'Quantidade',
    required: false,
    description: 'Volume ou quantidade de unidades faturadas (kg, sc, un)',
    aliases: [
      'quantidade',
      'qtd',
      'volume',
      'peso',
      'quant',
      'qtd_faturada',
      'kg',
      'unidades',
      'produto_quantidade',
      // Termos em inglês
      'quantity',
      'qty',
      'amount_qty',
    ],
  },
  {
    key: 'valor_unitario',
    label: 'Valor Unitário (R$)',
    required: false,
    description: 'Preço unitário por kg ou saca',
    aliases: [
      'unitario',
      'valor_unitario',
      'vl_unitario',
      'vlr_unit',
      'preco_unitario',
      'preco_unit',
      'preco',
      // Termos em inglês
      'unit_price',
      'price',
      'unit_value',
    ],
  },
  {
    key: 'valor_total_nota_usd',
    label: 'Valor Total da Nota (USD $)',
    required: false,
    description: 'Valor total consolidado da Nota Fiscal ou Pedido mãe em Dólar',
    aliases: [
      'total_nota_usd',
      'total nota usd',
      'valor_total_nota_usd',
      'valor total nota usd',
      'valor_nota_usd',
      'total_nf_usd',
      'valor_nf_usd',
      'invoice_total_usd',
      'invoice total usd',
    ],
  },
  {
    key: 'valor_total_nota',
    label: 'Valor Total da Nota (R$)',
    required: false,
    description: 'Valor total consolidado da Nota Fiscal mãe em Real',
    aliases: [
      'total_nota',
      'total_nota_brl',
      'total_nota_r$',
      'valor_total_nota',
      'valor_nota',
      'vl_nota',
      'total_nf',
      'valor_nf',
      'invoice_total',
    ],
  },
  {
    key: 'vendedor',
    label: 'Vendedor / Representante',
    required: false,
    description: 'Nome do consultor ou vendedor responsável',
    aliases: [
      'vendedor',
      'consultor',
      'representante',
      'comercial',
      'vendedor_nome',
      'nome_vendedor',
      'rca',
      // Termos em inglês
      'seller',
      'salesperson',
      'sales_rep',
      'rep',
    ],
  },
  {
    key: 'gestor',
    label: 'Gestor Técnico / Comercial',
    required: false,
    description: 'Nome do gestor técnico/comercial responsável',
    aliases: [
      'gestor',
      'gestor_tecnico',
      'gt',
      'gerente',
      'responsavel_tecnico',
      'gestor_comercial',
      // Termos em inglês
      'manager',
      'technical_manager',
    ],
  },
  {
    key: 'unidade',
    label: 'Filial / Unidade',
    required: false,
    description: 'Filial ou planta de expedição/faturamento (ex: Maringá, CD)',
    aliases: [
      'unidade',
      'filial',
      'planta',
      'fabrica',
      'origem_faturamento',
      'cd',
      'armazem',
      // Termos em inglês
      'branch',
      'unit',
      'plant',
      'warehouse',
    ],
  },
  {
    key: 'canal_vendas',
    label: 'Canal de Vendas',
    required: false,
    description: 'Direto, Distribuidor, Indústria, Premixera, Cooperativa, Online',
    aliases: [
      'canal',
      'canal_vendas',
      'canal_de_vendas',
      'tipo_venda',
      'modalidade',
      // Termos em inglês
      'channel',
      'sales_channel',
    ],
  },
  {
    key: 'status',
    label: 'Status do Pedido',
    required: false,
    description: 'Realizado (faturado) ou Projetado (em carteira)',
    aliases: [
      'status',
      'situacao',
      'estado_pedido',
      'fase',
      // Termos em inglês
      'order_status',
      'state',
    ],
  },
  {
    key: 'familia_produto',
    label: 'Família de Produtos',
    required: false,
    description: 'Família ou linha do produto (ex: Minerais Orgânicos, Adsorventes, Blends)',
    aliases: [
      'familia',
      'familia_produto',
      'familia_produtos',
      'familia_de_produtos',
      'familia de produtos',
      'linha_produto',
      'linha de produtos',
      'grupo_produto',
      'categoria_produto',
      // Termos em inglês
      'product_family',
      'family',
    ],
  },
  {
    key: 'country',
    label: 'País / Destino',
    required: false,
    description: 'País da operação ou faturamento (ex: Brasil, Paraguai, etc.)',
    aliases: ['country', 'pais', 'país', 'pais_destino', 'pais_operacao', 'nacao'],
  },
]

function normalizeKey(str: string): string {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Converte qualquer representação de data (serial Excel, ISO YYYY-MM-DD, DD/MM/AAAA, etc.)
 * para o formato legível DD/MM/AAAA conforme critério de aceite.
 */
export function parseDateBR(val: unknown): string {
  if (val === undefined || val === null || val === '') return '—'

  // Serial numérico do Excel
  if (typeof val === 'number') {
    if (val > 10000 && val < 90000) {
      const dExcel = new Date(Math.round((val - 25569) * 86400 * 1000))
      if (!isNaN(dExcel.getTime())) {
        const d = String(dExcel.getUTCDate()).padStart(2, '0')
        const m = String(dExcel.getUTCMonth() + 1).padStart(2, '0')
        const y = dExcel.getUTCFullYear()
        return `${d}/${m}/${y}`
      }
    }
  }

  const s = String(val).trim()
  if (!s) return '—'

  // ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const y = isoMatch[1]
    const m = isoMatch[2].padStart(2, '0')
    const d = isoMatch[3].padStart(2, '0')
    return `${d}/${m}/${y}`
  }

  // DD/MM/AAAA ou DD-MM-AAAA ou DD.MM.AAAA
  const brMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (brMatch) {
    const d = brMatch[1].padStart(2, '0')
    const m = brMatch[2].padStart(2, '0')
    let y = parseInt(brMatch[3], 10)
    if (y < 100) y += 2000
    return `${d}/${m}/${y}`
  }

  // MM/AAAA ou MM-AAAA
  const mmyyyyMatch = s.match(/^(\d{1,2})[/.-](\d{4})$/)
  if (mmyyyyMatch) {
    const m = mmyyyyMatch[1].padStart(2, '0')
    const y = mmyyyyMatch[2]
    return `01/${m}/${y}`
  }

  // Date nativo fallback
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0')
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const y = parsed.getFullYear()
    return `${d}/${m}/${y}`
  }

  return s
}

/**
 * Extrai o nome limpo do cliente: faz o split no primeiro " - " de cliente_cod_descricao
 * (ex: "CBR00024 - Scarpim Alimentos Ltda" -> "Scarpim Alimentos Ltda")
 */
export function parseClientName(val: unknown): string {
  if (val === undefined || val === null || val === '') return '—'
  const s = String(val).trim()
  if (!s) return '—'

  // Split no primeiro " - "
  const dashIdx = s.indexOf(' - ')
  if (dashIdx !== -1) {
    const candidate = s.substring(dashIdx + 3).trim()
    if (candidate) return candidate
  }

  // Suporte a outros hífens: " – " ou " — "
  const altDashMatch = s.match(/^[^–—-]+[–—-]\s*(.+)$/)
  if (altDashMatch && altDashMatch[1].trim()) {
    return altDashMatch[1].trim()
  }

  return s
}

/**
 * Extrai a descrição limpa do produto: faz o split no primeiro " - " de item_codigo_descricao
 * (ex: "BPMI.OR033 - Blink Zinc 17 - SC" -> "Blink Zinc 17 - SC")
 */
export function parseProductDesc(val: unknown): string {
  if (val === undefined || val === null || val === '') return '—'
  const s = String(val).trim()
  if (!s) return '—'

  const dashIdx = s.indexOf(' - ')
  if (dashIdx !== -1) {
    const candidate = s.substring(dashIdx + 3).trim()
    if (candidate) return candidate
  }

  return s
}

/**
 * Sugere automaticamente o mapeamento de colunas da planilha para os campos do CRM
 * de forma resiliente a acentos, maiúsculas/minúsculas, espaços e pontuações.
 */
export function autoSuggestMapping(
  sheetHeaders: string[],
): Record<string, FaturamentoFieldKey | ''> {
  const mapping: Record<string, FaturamentoFieldKey | ''> = {}
  const usedCRMFields = new Set<FaturamentoFieldKey>()

  sheetHeaders.forEach((header) => {
    const norm = normalizeKey(header)
    if (!norm) {
      mapping[header] = ''
      return
    }

    // Regras prioritárias para Valor em Dólar (USD) vs Real (R$)
    // Prioritário verificar antes de 'cliente' ou 'produto'
    const isUsdHeader =
      norm.includes('usd') ||
      norm.includes('dolar') ||
      norm.includes('dollar') ||
      norm.includes('amount') ||
      norm === 'u' ||
      norm === 'us'

    const isBrlHeader =
      norm.includes('brl') ||
      norm.includes('r$') ||
      norm.includes('reais') ||
      norm.includes('real') ||
      norm.includes('rs')

    const isUnitHeader = norm.includes('unit') || norm.includes('preco') || norm.includes('precode')

    // Soma de Vlr Total - USD
    if (
      (norm.includes('somadevlr') || norm.includes('somavlr') || norm.includes('vlrtotal')) &&
      isUsdHeader
    ) {
      if (!usedCRMFields.has('valor_usd')) {
        mapping[header] = 'valor_usd'
        usedCRMFields.add('valor_usd')
        return
      }
    }

    // Soma de Vlr Total - BRL (ou Soma de Vlr Total sem indicação de USD)
    if (
      (norm.includes('somadevlr') || norm.includes('somavlr') || norm.includes('vlrtotal')) &&
      !isUsdHeader
    ) {
      if (!usedCRMFields.has('valor')) {
        mapping[header] = 'valor'
        usedCRMFields.add('valor')
        return
      }
    }

    if (isUsdHeader && isUnitHeader) {
      if (!usedCRMFields.has('valor_unitario_usd')) {
        mapping[header] = 'valor_unitario_usd'
        usedCRMFields.add('valor_unitario_usd')
        return
      }
    } else if (isUsdHeader) {
      if (!usedCRMFields.has('valor_usd')) {
        mapping[header] = 'valor_usd'
        usedCRMFields.add('valor_usd')
        return
      }
    } else if (isBrlHeader && isUnitHeader) {
      if (!usedCRMFields.has('valor_unitario')) {
        mapping[header] = 'valor_unitario'
        usedCRMFields.add('valor_unitario')
        return
      }
    } else if (
      isBrlHeader &&
      (norm.includes('total') || norm.includes('valor') || norm.includes('vlr'))
    ) {
      if (!usedCRMFields.has('valor')) {
        mapping[header] = 'valor'
        usedCRMFields.add('valor')
        return
      }
    }

    // Regras prioritárias para padrões específicos conhecidos do export CRM_Faturamento
    // Ex: "Item - Cod. & Descrição" ou item_codigo_descricao
    if (
      (norm.includes('item') && (norm.includes('cod') || norm.includes('descri'))) ||
      norm.includes('itemcodigo') ||
      norm === 'item' ||
      norm === 'produto'
    ) {
      if (!usedCRMFields.has('produto')) {
        mapping[header] = 'produto'
        usedCRMFields.add('produto')
        return
      }
    }

    // Ex: "Cliente - Cod. & Descrição" ou cliente_cod_descricao
    if (
      (norm.includes('cliente') && (norm.includes('cod') || norm.includes('descri'))) ||
      norm.includes('clientecod')
    ) {
      if (!usedCRMFields.has('cliente')) {
        mapping[header] = 'cliente'
        usedCRMFields.add('cliente')
        return
      }
    }

    // Ex: "docdate", "doc date", "data_documento", "data_faturamento", etc.
    // Prioridade máxima para docdate como data real do faturamento/pedido
    if (
      norm === 'docdate' ||
      norm === 'data' ||
      norm === 'datafaturamento' ||
      norm === 'datadocumento' ||
      norm === 'dataemissao' ||
      norm === 'datapedido'
    ) {
      if (!usedCRMFields.has('data')) {
        mapping[header] = 'data'
        usedCRMFields.add('data')
        return
      }
    }

    // NF / Documento / Ano de NF
    // Colunas nf_ano ou nf_ano_mes devem ser mapeadas para numero_documento caso este ainda não exista
    if (norm === 'nfano' || norm === 'nfanomes') {
      if (!usedCRMFields.has('numero_documento')) {
        mapping[header] = 'numero_documento'
        usedCRMFields.add('numero_documento')
        return
      }
    }

    // Fallbacks secundários de data: apenas se 'data' ainda não tiver sido associada
    if (
      (norm.includes('mes') && norm.includes('ano')) ||
      (norm.includes('month') && norm.includes('year')) ||
      norm === 'mes' ||
      norm === 'competencia' ||
      norm === 'period' ||
      norm === 'periodo'
    ) {
      if (!usedCRMFields.has('data')) {
        mapping[header] = 'data'
        usedCRMFields.add('data')
        return
      }
    }

    // Ex: "familia de produtos", "familia_de_produtos"
    // No passo 3 / visualização e CRM, a coluna família deve ser mapeada para o campo 'especie'
    // (ou 'familia_produto', garantindo que alimente a coluna ESPÉCIE)
    if (
      norm.includes('familiadeproduto') ||
      norm.includes('familiadeprodutos') ||
      norm === 'familia'
    ) {
      if (!usedCRMFields.has('especie')) {
        mapping[header] = 'especie'
        usedCRMFields.add('especie')
        return
      } else if (!usedCRMFields.has('familia_produto')) {
        mapping[header] = 'familia_produto'
        usedCRMFields.add('familia_produto')
        return
      }
    }

    // Ex: "country", "pais"
    if (norm === 'country' || norm === 'pais') {
      if (!usedCRMFields.has('country')) {
        mapping[header] = 'country'
        usedCRMFields.add('country')
        return
      }
    }

    // Procura exato ou alias
    let matchedField: FaturamentoFieldKey | '' = ''

    // 1. Match exato com key
    for (const def of FATURAMENTO_FIELDS) {
      if (normalizeKey(def.key) === norm && !usedCRMFields.has(def.key)) {
        matchedField = def.key
        break
      }
    }

    // 2. Match com aliases exato
    if (!matchedField) {
      for (const def of FATURAMENTO_FIELDS) {
        if (usedCRMFields.has(def.key)) continue
        const aliasMatch = def.aliases.some((al) => {
          const normAl = normalizeKey(al)
          return normAl === norm
        })
        if (aliasMatch) {
          matchedField = def.key
          break
        }
      }
    }

    // 3. Match substring (se o alias está contido no header ou header no alias)
    if (!matchedField) {
      for (const def of FATURAMENTO_FIELDS) {
        if (usedCRMFields.has(def.key)) continue
        const subMatch = def.aliases.some((al) => {
          const normAl = normalizeKey(al)
          return (
            (normAl.length >= 4 && norm.includes(normAl)) ||
            (norm.length >= 4 && normAl.includes(norm))
          )
        })
        if (subMatch) {
          matchedField = def.key
          break
        }
      }
    }

    if (matchedField) {
      mapping[header] = matchedField
      usedCRMFields.add(matchedField)
    } else {
      mapping[header] = ''
    }
  })

  return mapping
}

export interface FaturamentoImportOptions {
  criarClienteNaoEncontrado: boolean
}

export interface FaturamentoImportError {
  linha: number
  erro: string
}

export interface FaturamentoImportResult {
  success: boolean
  criados: number
  atualizados: number
  duplicatasIgnoradas: number
  clientesVinculados: number
  clientesVinculadosPorCodigo?: number
  clientesVinculadosPorNome?: number
  clientesVinculadosPorCnpj?: number
  clientesCriados: number
  clientesNaoIdentificados: number
  clientesAtualizadosNoCRM: number
  total_rows?: number
  imported?: number
  skipped_duplicates?: number
  skipped_zero?: number
  errors?: number
  error_details?: FaturamentoImportError[]
  totalLinhas: number
  total?: number
  faturamentoImportados?: number
  faturamentoDuplicatas?: number
  faturamentoErrosCount?: number
  erros: FaturamentoImportError[]
}

/**
 * Lê a planilha e retorna as primeiras N linhas como objetos crus para preview
 */
/**
 * Normaliza o texto de cabeçalho para comparação tolerante:
 * remove acentos, converte quebras de linha/espaços múltiplos em espaço simples,
 * converte para minúsculas e remove caracteres especiais.
 */
function normalizeHeaderComparable(header: string): string {
  if (!header) return ''
  return String(header)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Normaliza o nome do cabeçalho mantendo a legibilidade:
 * substitui quebras de linha e múltiplos espaços por um espaço simples e faz trim.
 */
function cleanHeaderName(header: string): string {
  if (!header) return ''
  return String(header)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Padrões de cabeçalho esperados no export do CRM/ERP Blink.
 */
const EXPECTED_HEADER_PATTERNS = [
  'clientecoddescricao',
  'cliente',
  'docdate',
  'data',
  'itemcodigodescricao',
  'produto',
  'familiadeprodutos',
  'familiaproduto',
  'somadevlrvalortotalbrl',
  'somadevlrvalortotalusd',
  'somadevlrbrl',
  'somadevlrusd',
  'somadevlr',
  'somatotal',
  'somadevlrbrl',
  'vlrbrl',
  'vlrusd',
  'vendedor',
  'country',
  'pais',
  'nfano',
  'nfanomes',
  'especie',
  'quantidade',
]

/**
 * Avalia se uma linha de células de matriz bruta parece ser uma linha de cabeçalho.
 * Retorna uma pontuação de relevância.
 */
function scoreHeaderCandidate(row: unknown[]): number {
  if (!row || !Array.isArray(row) || row.length === 0) return 0

  let matchCount = 0
  let stringCount = 0
  let currencyOrNumberCount = 0

  for (const cell of row) {
    if (cell === null || cell === undefined || cell === '') continue
    const s = String(cell).trim()
    if (!s) continue

    // Se a célula começa com moeda, como R$, US$, $, é forte indício de valor numérico/agregado
    if (/^(?:r\$|us\$|\$|€)\s*[\d.,]+/i.test(s) || /^\d+(?:[.,]\d+)?$/.test(s)) {
      currencyOrNumberCount++
    }

    const norm = normalizeHeaderComparable(s)
    if (norm) {
      stringCount++
      const matchesExpected = EXPECTED_HEADER_PATTERNS.some(
        (pat) => norm === pat || norm.includes(pat) || (norm.length >= 4 && pat.includes(norm)),
      )
      if (matchesExpected) {
        matchCount++
      }
    }
  }

  // Se a linha tem muitos números/moedas e poucas strings de texto, penalizar fortemente
  if (currencyOrNumberCount > stringCount) {
    return 0
  }

  return matchCount * 10 + stringCount
}

/**
 * Detecta se uma linha de dados é uma linha agregada/de total ou linha vazia:
 * Ex: Linha que contém "Total Geral", "Total:", "Soma de...", "Subtotal",
 * ou linha em que cliente e produto estão vazios enquanto só há números de soma.
 */
function isSummaryOrTotalRow(rowObj: Record<string, unknown>, headers: string[]): boolean {
  if (!rowObj) return true

  // Verificar valores nas colunas
  const values = headers.map((h) => String(rowObj[h] ?? '').trim()).filter(Boolean)
  if (values.length === 0) return true

  // Se a primeira coluna não-vazia contém explicitamente termos de totalização
  const firstVal = values[0].toLowerCase()
  if (
    firstVal.startsWith('total geral') ||
    firstVal.startsWith('total:') ||
    firstVal === 'total' ||
    firstVal.startsWith('subtotal') ||
    firstVal.startsWith('resumo') ||
    firstVal.startsWith('consolidado')
  ) {
    return true
  }

  // Se qualquer célula contiver "Total Geral"
  for (const val of values) {
    const vLower = val.toLowerCase()
    if (vLower === 'total geral' || vLower === 'total' || vLower.startsWith('total geral:')) {
      return true
    }
  }

  return false
}

/**
 * Seleciona a melhor planilha da pasta de trabalho (a que possui mais células preenchidas)
 */
function selectBestWorksheet(workbook: XLSX.WorkBook): {
  sheetName: string
  worksheet: XLSX.WorkSheet
} {
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('A planilha enviada não contém nenhuma aba.')
  }

  let bestSheetName = workbook.SheetNames[0]
  let bestCellCount = -1

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]
    if (!ws) continue
    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
    if (range) {
      const cellCount = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1)
      if (cellCount > bestCellCount) {
        bestCellCount = cellCount
        bestSheetName = sheetName
      }
    }
  }

  return {
    sheetName: bestSheetName,
    worksheet: workbook.Sheets[bestSheetName],
  }
}

/**
 * Extrai cabeçalhos e linhas limpas a partir da planilha:
 * 1. Converte a aba em matriz 2D bruta (raw: false para preservar strings formatadas).
 * 2. Varre as primeiras 20 linhas procurando a linha com maior contagem de colunas reconhecidas.
 * 3. Se nenhum cabeçalho conhecido for detectado, usa a primeira linha não-vazia com pelo menos 2 colunas.
 * 4. Normaliza os nomes de colunas (quebras de linha, espaços repetidos, nomes duplicados com _2, _3).
 * 5. Filtra linhas vazias e linhas de total/resumo.
 */
function parseWorksheetToRows(worksheet: XLSX.WorkSheet): {
  headers: string[]
  rows: Record<string, unknown>[]
} {
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  })

  if (!matrix || matrix.length === 0) {
    return { headers: [], rows: [] }
  }

  // 1. Procurar a linha de cabeçalho nas primeiras 20 linhas
  let bestRowIndex = 0
  let maxScore = -1

  const scanLimit = Math.min(20, matrix.length)
  for (let r = 0; r < scanLimit; r++) {
    const row = matrix[r]
    if (!row || !Array.isArray(row)) continue

    const score = scoreHeaderCandidate(row)
    if (score > maxScore) {
      maxScore = score
      bestRowIndex = r
    }
  }

  // Se a pontuação máxima ainda for 0 (nenhum padrão conhecido), encontrar a primeira linha com >= 2 células de texto não-vazias
  if (maxScore <= 0) {
    for (let r = 0; r < scanLimit; r++) {
      const row = matrix[r]
      if (!row || !Array.isArray(row)) continue
      const filledTextCells = row.filter((c) => {
        if (c === null || c === undefined) return false
        const s = String(c).trim()
        return s.length > 0 && !/^(?:r\$|us\$|\$)\s*[\d.,]+/i.test(s)
      })
      if (filledTextCells.length >= 2) {
        bestRowIndex = r
        break
      }
    }
  }

  const rawHeaderRow = matrix[bestRowIndex] || []

  // Montar lista de cabeçalhos únicos e limpos
  const headers: string[] = []
  const usedHeaders = new Map<string, number>()

  for (let c = 0; c < rawHeaderRow.length; c++) {
    const cell = rawHeaderRow[c]
    let name = cleanHeaderName(String(cell || ''))
    if (!name) {
      // Se a coluna não tiver nome mas houver dados abaixo, gerar um identificador Coluna N
      name = `Coluna_${c + 1}`
    }

    const currentCount = usedHeaders.get(name) || 0
    if (currentCount > 0) {
      usedHeaders.set(name, currentCount + 1)
      headers.push(`${name}_${currentCount + 1}`)
    } else {
      usedHeaders.set(name, 1)
      headers.push(name)
    }
  }

  // Se nenhum cabeçalho válido foi montado, fallback
  if (headers.length === 0) {
    return { headers: [], rows: [] }
  }

  // 2. Extrair as linhas de dados após a linha de cabeçalho
  const rows: Record<string, unknown>[] = []
  for (let r = bestRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r]
    if (!row || !Array.isArray(row)) continue

    const rowObj: Record<string, unknown> = {}
    let hasAnyValue = false

    for (let c = 0; c < headers.length; c++) {
      const headerName = headers[c]
      const val = row[c] !== undefined && row[c] !== null ? row[c] : ''
      rowObj[headerName] = val
      if (String(val).trim() !== '') {
        hasAnyValue = true
      }
    }

    if (!hasAnyValue) continue

    // Ignorar linhas de totais/resumo agregado
    if (isSummaryOrTotalRow(rowObj, headers)) {
      continue
    }

    rows.push(rowObj)
  }

  return { headers, rows }
}

/**
 * Lê a planilha e retorna os cabeçalhos detectados e as primeiras N linhas como objetos crus para preview.
 * Resiliente a abas múltiplas, células mescladas, quebras de linha e linhas de totais.
 */
export async function parseFaturamentoPreview(
  file: File,
  maxRows = 10,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const { worksheet } = selectBestWorksheet(workbook)

  const { headers, rows } = parseWorksheetToRows(worksheet)

  return {
    headers,
    rows: rows.slice(0, maxRows),
  }
}

/**
 * Lê todas as linhas do arquivo, aplica o mapeamento definido pelo usuário
 * e envia para o backend /backend/v1/importar-faturamento
 */
export async function importFaturamento(
  file: File,
  mapping: Record<string, FaturamentoFieldKey | ''>,
  options: FaturamentoImportOptions,
): Promise<FaturamentoImportResult> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const { worksheet } = selectBestWorksheet(workbook)

  const { rows: cleanRows } = parseWorksheetToRows(worksheet)

  // Mapear cada linha bruta limpa para o schema canônico esperado pelo backend
  const mappedRows = cleanRows.map((rawRow) => {
    const canonRow: Record<string, unknown> = {}
    // Preservar também as chaves brutas normalizadas da linha para que hooks do backend
    // (ex.: faturamento collection que lê item.familia_de_produtos, item.country, etc.)
    // continuem tendo acesso completo às colunas de origem do Excel.
    Object.entries(rawRow).forEach(([header, value]) => {
      const targetField = mapping[header]
      if (targetField) {
        canonRow[targetField] = value
      }
      const rawKey = header
        .toLowerCase()
        .replace(/[\r\n\t]+/g, ' ')
        .trim()
      canonRow[rawKey] = value
    })
    return canonRow
  })

  return pb.send<FaturamentoImportResult>('/backend/v1/importar-faturamento', {
    method: 'POST',
    body: JSON.stringify({
      rows: mappedRows,
      options,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Gera e faz download de uma planilha modelo (.xlsx) para importação de faturamento
 */
export function downloadFaturamentoTemplate(): void {
  const sampleData = [
    {
      'Data Faturamento': '2026-08-15',
      'Número NF': '10452',
      Cliente: '1001 - Cooperativa Agroindustrial Exemplo Ltda',
      CNPJ: '00.000.000/0001-91',
      'Código Produto': 'BPMI.OR035',
      Produto: 'BPMI.OR035 - Blink Zinc 22 - SC',
      'Família de Produtos': 'Minerais Orgânicos',
      País: 'Brasil',
      Espécie: 'Ruminantes',
      Quantidade: 2000,
      'Valor Unitário USD': 3.3,
      'Valor Total (USD)': 6600.0,
      'Valor Total (R$)': 36300.0,
      Vendedor: 'Felipe Leão',
      Unidade: 'Maringá CD',
      'Canal de Vendas': 'Direto',
      Status: 'realizado',
    },
    {
      'Data Faturamento': '2026-08-20',
      'Número NF': '10453',
      Cliente: '1002 - Nutrição Animal do Brasil S/A',
      CNPJ: '11.222.333/0001-44',
      'Código Produto': 'BPMI.OR015',
      Produto: 'BPMI.OR015 - Blink Copper 22 - SC',
      'Família de Produtos': 'Minerais Orgânicos',
      País: 'Brasil',
      Espécie: 'Aves',
      Quantidade: 1500,
      'Valor Unitário USD': 5.7,
      'Valor Total (USD)': 8550.0,
      'Valor Total (R$)': 47025.0,
      Vendedor: 'Felipe Leão',
      Unidade: 'Maringá CD',
      'Canal de Vendas': 'Indústria',
      Status: 'realizado',
    },
  ]

  const ws = XLSX.utils.json_to_sheet(sampleData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Faturamento')
  XLSX.writeFile(wb, 'modelo_faturamento_crm_blink.xlsx')
}
