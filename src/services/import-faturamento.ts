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
  | 'valor'
  | 'valor_unitario'
  | 'valor_total_nota'
  | 'vendedor'
  | 'gestor'
  | 'unidade'
  | 'canal_vendas'
  | 'status'

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
      // Termos em inglês comumente presentes em planilhas de ERP/BI
      'date',
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
      // Termos em inglês
      'customer',
      'client',
      'customer_name',
      'client_name',
      'customer/client',
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
    key: 'valor',
    label: 'Valor Total do Pedido / Item (R$)',
    required: true,
    description: 'Valor total faturado (ex: 15420.50 ou 15.420,50)',
    aliases: [
      'valor',
      'total',
      'valor_total',
      'valor total',
      'vl_total',
      'vlr_total',
      'faturamento',
      'faturado',
      'valor_faturado',
      'valor faturado',
      'total_item',
      'valor_item',
      'produto_valor_total',
      'valor_liquido',
      'liquido',
      // Termos em inglês
      'amount',
      'value',
      'total_amount',
      'total_value',
      'revenue',
      'sales_value',
      'price_total',
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
    key: 'valor_total_nota',
    label: 'Valor Total da Nota (se agrupada)',
    required: false,
    description: 'Valor total consolidado da Nota Fiscal mãe',
    aliases: [
      'total_nota',
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

    // Regras prioritárias para padrões específicos conhecidos
    // Ex: "Cliente - Cod. & Descrição" ou variações de código e descrição
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

    // Ex: Colunas de mês/ano, período ou data (ex: "Mes/Ano", "Mes e Ano", "Ano/Mes")
    if (
      (norm.includes('mes') && norm.includes('ano')) ||
      norm === 'mes' ||
      norm === 'competencia'
    ) {
      if (!usedCRMFields.has('data')) {
        mapping[header] = 'data'
        usedCRMFields.add('data')
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
  totalLinhas: number
  erros: FaturamentoImportError[]
}

/**
 * Lê a planilha e retorna as primeiras N linhas como objetos crus para preview
 */
export async function parseFaturamentoPreview(
  file: File,
  maxRows = 10,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('A planilha enviada não contém nenhuma aba.')
  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  })

  // Descobrir todos os cabeçalhos únicos das primeiras 50 linhas
  const headersSet = new Set<string>()
  rows.slice(0, 50).forEach((row) => {
    Object.keys(row).forEach((k) => {
      const cleanK = String(k || '').trim()
      if (cleanK && !cleanK.startsWith('__EMPTY')) {
        headersSet.add(cleanK)
      }
    })
  })

  return {
    headers: Array.from(headersSet),
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
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('A planilha enviada não contém nenhuma aba.')
  const worksheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  })

  // Mapear cada linha bruta para o schema canônico esperado pelo backend
  const mappedRows = rawRows.map((rawRow) => {
    const canonRow: Record<string, unknown> = {}
    Object.entries(rawRow).forEach(([header, value]) => {
      const targetField = mapping[header]
      if (targetField) {
        canonRow[targetField] = value
      }
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
      Cliente: 'Cooperativa Agroindustrial Exemplo Ltda',
      CNPJ: '00.000.000/0001-91',
      'Código Produto': 'BPMI.OR035',
      Produto: 'Blink Zinc 22 - SC',
      Espécie: 'Ruminantes',
      Quantidade: 2000,
      'Valor Unitário': 16.5,
      'Valor Total': 33000.0,
      Vendedor: 'Felipe Leão',
      'Gestor Técnico': 'Rodrigo Gardinal',
      Unidade: 'Maringá CD',
      'Canal de Vendas': 'Direto',
      Status: 'realizado',
    },
    {
      'Data Faturamento': '2026-08-20',
      'Número NF': '10453',
      Cliente: 'Nutrição Animal do Brasil S/A',
      CNPJ: '11.222.333/0001-44',
      'Código Produto': 'BPMI.OR015',
      Produto: 'Blink Copper 22 - SC',
      Espécie: 'Aves',
      Quantidade: 1500,
      'Valor Unitário': 28.5,
      'Valor Total': 42750.0,
      Vendedor: 'Felipe Leão',
      'Gestor Técnico': 'Jéssica Dilkin',
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
