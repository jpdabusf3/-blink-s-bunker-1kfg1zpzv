import type { Factory } from '@/types'
import { formatCNPJ } from '@/lib/cnpj'
import {
  openCorporatePdfReport,
  exportCorporateExcel,
  formatDataBR,
  type PdfSection,
} from '@/lib/corporateDocuments'
import { normalizeProfileList } from '@/constants/clientCategories'
import { normalizeSellerName } from '@/lib/vendedorFilterHelper'

export interface ClientExportFiltersDesc {
  busca?: string
  segmento?: string
  uf?: string
  vendedor?: string
  somenteSemVendedor?: boolean
}

function getClientVendedorName(c: Factory, vendedorMap?: Map<string, string>): string {
  let raw = ''
  if (c.vendedor_name && c.vendedor_name.trim()) raw = c.vendedor_name
  else if (c.vendedor_id && vendedorMap?.has(c.vendedor_id)) {
    raw = vendedorMap.get(c.vendedor_id)!
  } else if (c.expand?.vendedor_id?.nome) raw = c.expand.vendedor_id.nome
  else if (c.expand?.vendedor?.nome) raw = c.expand.vendedor.nome
  if (raw) {
    return normalizeSellerName(raw)
  }
  return 'Não atribuído'
}

function getClientProfileText(c: Factory): string {
  const profiles = normalizeProfileList(c.profile_type)
  return profiles.length > 0 ? profiles.join(', ') : 'Não informado'
}

function truncateText(str?: string | null, max = 80): string {
  if (!str) return '—'
  const clean = str.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max)}...`
}

/**
 * Exporta a lista de clientes filtrada para Excel (.xlsx) no padrão corporativo Blink.
 * Padrão de nome: clientes-blink-AAAA-MM-DD.xlsx
 */
export function exportClientesToExcel(
  clientes: Factory[],
  filtersDesc: ClientExportFiltersDesc,
  vendedorMap?: Map<string, string>,
) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStamp = `${yyyy}-${mm}-${dd}`

  const filtrosStr =
    [
      filtersDesc.busca ? `Busca: "${filtersDesc.busca}"` : null,
      filtersDesc.segmento && filtersDesc.segmento !== 'all'
        ? `Segmento: ${filtersDesc.segmento}`
        : null,
      filtersDesc.uf && filtersDesc.uf !== 'all' ? `UF: ${filtersDesc.uf}` : null,
      filtersDesc.somenteSemVendedor
        ? 'Filtro Especial: Apenas clientes sem vendedor atribuído (órfãos)'
        : filtersDesc.vendedor && filtersDesc.vendedor !== 'all'
          ? `Vendedor: ${filtersDesc.vendedor}`
          : null,
    ]
      .filter(Boolean)
      .join(' | ') || 'Visão Global / Sem filtros restritivos'

  exportCorporateExcel({
    slug: 'clientes-blink',
    metadata: {
      titulo: 'Relatório Cadastral de Clientes e Carteira B2B',
      subtitulo: 'Lista Analítica e Segmentada de Clientes Ativos e Contatos Comerciais',
      origem: 'Módulo de Clientes (/clientes /cadastro)',
      periodo: dateStamp,
      filtros: filtrosStr,
      totalizacoes: [{ label: 'TOTAL DE CLIENTES:', valor: clientes.length }],
    },
    columns: [
      { key: 'razaoSocial', label: 'Razão Social', width: 34 },
      { key: 'cnpj', label: 'CNPJ', width: 22 },
      { key: 'cidade', label: 'Cidade', width: 20 },
      { key: 'uf', label: 'UF', width: 8 },
      { key: 'segmento', label: 'Segmento', width: 16 },
      { key: 'vendedor', label: 'Vendedor', width: 24 },
      { key: 'perfil', label: 'Categoria / Perfil', width: 24 },
      { key: 'status', label: 'Status / Ativo', width: 16 },
      { key: 'observacoes', label: 'Observações', width: 40 },
    ],
    rows: clientes.map((c) => ({
      razaoSocial: c.name || 'Sem razão social',
      cnpj: formatCNPJ(c.cnpj) || '—',
      cidade: c.city || '—',
      uf: c.state ? c.state.toUpperCase() : '—',
      segmento: c.carteira || '—',
      vendedor: getClientVendedorName(c, vendedorMap),
      perfil: getClientProfileText(c),
      status: c.status_funil || c.status || 'Ativo',
      observacoes: truncateText(c.observacoes || c.notes || c.suggested_approach, 120),
    })),
  })
}

/**
 * Exporta a lista de clientes filtrada para PDF no padrão corporativo Blink.
 * Padrão de nome: clientes-blink-AAAA-MM-DD.pdf
 */
export function exportClientesToPDF(
  clientes: Factory[],
  filtersDesc: ClientExportFiltersDesc,
  vendedorMap?: Map<string, string>,
) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStamp = `${yyyy}-${mm}-${dd}`

  const semVendedorCount = clientes.filter(
    (c) => getClientVendedorName(c, vendedorMap) === 'Não atribuído',
  ).length

  const filtrosObj: Record<string, string> = {}
  if (filtersDesc.busca) filtrosObj['Busca'] = filtersDesc.busca
  if (filtersDesc.segmento && filtersDesc.segmento !== 'all')
    filtrosObj['Segmento'] = filtersDesc.segmento
  if (filtersDesc.uf && filtersDesc.uf !== 'all') filtrosObj['UF'] = filtersDesc.uf
  if (filtersDesc.somenteSemVendedor) {
    filtrosObj['Status Comercial'] = 'Sem vendedor atribuído (órfãos)'
  } else if (filtersDesc.vendedor && filtersDesc.vendedor !== 'all') {
    filtrosObj['Vendedor'] = filtersDesc.vendedor
  }

  const sections: PdfSection[] = [
    {
      numero: 1,
      titulo: 'Indicadores do Cadastro de Clientes',
      descricao:
        'Resumo geral dos registros selecionados com base nos filtros aplicados nesta consulta.',
      kpis: [
        {
          label: 'Total de Clientes',
          valor: String(clientes.length),
          sub: 'Registros listados',
          accent: 'primary',
        },
        {
          label: 'Sem Vendedor Atribuído',
          valor: String(semVendedorCount),
          sub: semVendedorCount > 0 ? 'Requerem vínculo comercial' : 'Carteira 100% atribuída',
          accent: semVendedorCount > 0 ? 'amber' : 'emerald',
        },
        {
          label: 'Com Vendedor Atribuído',
          valor: String(clientes.length - semVendedorCount),
          sub: 'Vínculo ativo',
          accent: 'emerald',
        },
      ],
    },
    {
      numero: 2,
      titulo: 'Relação Analítica de Clientes',
      descricao:
        'Detalhamento com identificação fiscal, localização, vendedor responsável, categoria e observações.',
      table: {
        columns: [
          { header: 'Razão Social', align: 'left', isBold: true },
          { header: 'CNPJ', width: '135px', align: 'center' },
          { header: 'Cidade/UF', width: '120px', align: 'left' },
          { header: 'Segmento', width: '95px', align: 'center' },
          { header: 'Vendedor', width: '140px', align: 'left' },
          { header: 'Categoria / Perfil', width: '120px', align: 'left' },
          { header: 'Status', width: '80px', align: 'center' },
          { header: 'Observações', align: 'left' },
        ],
        rows: clientes.map((c) => [
          String(c.name || 'Sem razão social'),
          String(formatCNPJ(c.cnpj) || '—'),
          String([c.city?.trim(), c.state?.trim()?.toUpperCase()].filter(Boolean).join('/') || '—'),
          String(c.carteira || '—'),
          String(getClientVendedorName(c, vendedorMap)),
          String(getClientProfileText(c)),
          String(c.status_funil || c.status || 'Ativo'),
          String(truncateText(c.observacoes || c.notes || c.suggested_approach, 70)),
        ]),
        footerRow: [
          'TOTAL:',
          `${clientes.length} cliente(s)`,
          '',
          '',
          `${clientes.length - semVendedorCount} atribuído(s)`,
          '',
          '',
          `${semVendedorCount} sem vendedor`,
        ],
        emptyMessage: 'Nenhum cliente encontrado com os filtros selecionados.',
      },
    },
  ]

  return openCorporatePdfReport({
    titulo: 'Relatório Executivo de Clientes',
    subtitulo: 'Demonstrativo Cadastral, Localização e Distribuição de Carteira Comercial',
    origem: 'Módulo de Clientes (/clientes /cadastro)',
    periodo: dateStamp,
    filtros: Object.keys(filtrosObj).length > 0 ? filtrosObj : 'Todas as carteiras e vendedores',
    sections,
    orientacao: 'landscape',
  })
}
