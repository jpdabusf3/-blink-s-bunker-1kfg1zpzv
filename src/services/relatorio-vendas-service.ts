import pb from '@/lib/pocketbase/client'
import { familiaCompleta } from '@/constants/familiaProdutos'
import { normalizeSellerName } from '@/lib/vendedorFilterHelper'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import * as XLSX from 'xlsx'
import {
  openCorporatePdfReport,
  formatMoedaBRL,
  formatPercentBR,
  formatDataBR,
  type PdfSection,
} from '@/lib/corporateDocuments'

export type PeriodoPreset =
  | 'ultimos_30_dias'
  | 'mes_atual'
  | 'trimestre'
  | 'ano_atual'
  | 'personalizado'

export interface RelatorioVendasFiltros {
  periodoPreset: PeriodoPreset
  dataInicio: string // YYYY-MM-DD
  dataFim: string // YYYY-MM-DD
  segmentos: string[] // AVES, PETS, RUMINANTES, SUINOS
  vendedor: string // 'all' ou nome/ID do vendedor
  estado: string // 'all' ou UF
}

export type SecaoConteudoId =
  | 'resumo_executivo'
  | 'vendas_por_cliente'
  | 'vendas_por_segmento'
  | 'vendas_por_estado'
  | 'evolucao_mensal'
  | 'top_produtos'

export type FormatoRelatorio = 'tela' | 'pdf' | 'excel'

export interface RelatorioGeradoRecord {
  id: string
  user_id: string
  periodo: string
  filtros: string
  conteudo: string
  formato: string
  created: string
  updated: string
}

export interface ClienteVendaLinha {
  posicao: number
  nome: string
  codigo?: string
  uf: string
  segmento: string
  vendedor: string
  totalFaturado: number
  participacaoPercent: number
  qtdNotas: number
}

export interface SegmentoVendaLinha {
  segmento: string
  totalFaturado: number
  participacaoPercent: number
  qtdNotas: number
}

export interface EstadoVendaLinha {
  estado: string
  totalFaturado: number
  participacaoPercent: number
  qtdNotas: number
}

export interface EvolucaoMensalLinha {
  anoMes: string
  label: string
  totalFaturado: number
  qtdNotas: number
  ticketMedio: number
  variacaoAnteriorPercent: number | null
}

export interface TopProdutoLinha {
  posicao: number
  codigo: string
  descricao: string
  familia: string
  totalFaturado: number
  participacaoPercent: number
  qtdNotas: number
}

export interface RelatorioVendasCalculado {
  geradoEm: string
  periodoLabel: string
  filtros: RelatorioVendasFiltros
  secoes: SecaoConteudoId[]
  formato: FormatoRelatorio

  // Resumo executivo (KPIs)
  totalFaturado: number
  totalRegistros: number
  ticketMedio: number
  totalClientesAtivos: number

  // Seções detalhadas
  vendasPorCliente: ClienteVendaLinha[]
  vendasPorSegmento: SegmentoVendaLinha[]
  vendasPorEstado: EstadoVendaLinha[]
  evolucaoMensal: EvolucaoMensalLinha[]
  topProdutos: TopProdutoLinha[]
}

const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/**
 * Converte qualquer valor date/string para 'YYYY-MM-DD'
 */
export function toYmd(date: Date | string | null | undefined): string {
  if (!date) return ''
  const str = String(date).trim()
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10)
  }
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Calcula o intervalo de datas padrão de acordo com o preset selecionado
 */
export function getDatasPorPeriodoPreset(preset: PeriodoPreset): {
  dataInicio: string
  dataFim: string
} {
  const hoje = new Date()
  const yyyy = hoje.getFullYear()
  const mm = hoje.getMonth()
  const dd = hoje.getDate()

  if (preset === 'ultimos_30_dias') {
    const inicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { dataInicio: toYmd(inicio), dataFim: toYmd(hoje) }
  }

  if (preset === 'mes_atual') {
    const inicio = new Date(yyyy, mm, 1)
    return { dataInicio: toYmd(inicio), dataFim: toYmd(hoje) }
  }

  if (preset === 'trimestre') {
    const trimInicioMes = Math.floor(mm / 3) * 3
    const inicio = new Date(yyyy, trimInicioMes, 1)
    return { dataInicio: toYmd(inicio), dataFim: toYmd(hoje) }
  }

  if (preset === 'ano_atual') {
    const inicio = new Date(yyyy, 0, 1)
    return { dataInicio: toYmd(inicio), dataFim: toYmd(hoje) }
  }

  // Personalizado fallback
  const inicio = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { dataInicio: toYmd(inicio), dataFim: toYmd(hoje) }
}

export function getLabelPeriodoPreset(
  preset: PeriodoPreset,
  dInicio?: string,
  dFim?: string,
): string {
  switch (preset) {
    case 'ultimos_30_dias':
      return 'Últimos 30 dias'
    case 'mes_atual':
      return 'Mês atual'
    case 'trimestre':
      return 'Trimestre'
    case 'ano_atual':
      return 'Ano atual'
    case 'personalizado':
    default:
      if (dInicio && dFim) {
        return `${formatDataBR(dInicio)} a ${formatDataBR(dFim)}`
      }
      return 'Período Personalizado'
  }
}

interface RawSaleUnified {
  id: string
  data: string // YYYY-MM-DD
  clienteNome: string
  clienteCodigo?: string
  produtoCodigo: string
  produtoDescricao: string
  familia: string
  valorBrl: number
  uf: string
  segmento: string
  vendedor: string
}

/**
 * Consulta tabelas vivas (faturamento, historico_vendas e factories) sem cache obsoleto
 */
export async function buildRelatorioVendas(
  filtros: RelatorioVendasFiltros,
  secoes: SecaoConteudoId[],
  formato: FormatoRelatorio,
): Promise<RelatorioVendasCalculado> {
  // 1. Carregar fábricas / clientes vivos para enriquecimento de UF, Segmento e Vendedor
  let factoriesList: any[] = []
  try {
    factoriesList = await pb.collection('factories').getFullList({
      fields: 'id,name,state,carteira,codigo_cliente,cnpj,vendedor_id,vendedor_name',
    })
  } catch (err) {
    console.warn('[relatorio-vendas] factories fetch:', err)
  }

  const factoryByName = new Map<string, any>()
  const factoryByCode = new Map<string, any>()
  for (const f of factoriesList) {
    if (f.name) factoryByName.set(f.name.toLowerCase().trim(), f)
    if (f.codigo_cliente) factoryByCode.set(f.codigo_cliente.toUpperCase().trim(), f)
  }

  // 2. Carregar registros de faturamento e historico_vendas
  let fatRows: any[] = []
  try {
    fatRows = await pb.collection('faturamento').getFullList({
      filter: 'is_deleted != true',
      sort: '-data_documento',
    })
  } catch (err) {
    console.warn('[relatorio-vendas] faturamento fetch:', err)
  }

  let histRows: any[] = []
  try {
    histRows = await pb.collection('historico_vendas').getFullList({
      filter: 'is_deleted != true',
      sort: '-data_documento',
    })
  } catch (err) {
    console.warn('[relatorio-vendas] historico_vendas fetch:', err)
  }

  const unified: RawSaleUnified[] = []

  // Converte faturamento
  for (const r of fatRows) {
    const dataStr = toYmd(r.data_documento || r.created)
    const val = Number(r.valor_brl || 0)
    const cNome = (r.cliente_nome || '').trim()
    const cCod = (r.cliente_codigo || '').trim()
    const pCod = (r.produto_codigo || '').trim()
    const pDesc = (r.produto_descricao || '').trim()
    const fam = familiaCompleta(pCod, r.familia_produto)

    let factory = cCod ? factoryByCode.get(cCod.toUpperCase()) : undefined
    if (!factory && cNome) {
      factory = factoryByName.get(cNome.toLowerCase())
    }

    const uf = (factory?.state || r.country || '').trim().toUpperCase() || 'N/I'

    let seg = (factory?.carteira || '').trim().toUpperCase()
    if (!seg || seg === 'NONE') {
      const upperDesc = pDesc.toUpperCase()
      if (upperDesc.includes('PET')) seg = 'PETS'
      else if (upperDesc.includes('BOVINO') || upperDesc.includes('RUMINANTE')) seg = 'RUMINANTES'
      else if (upperDesc.includes('SUINO')) seg = 'SUINOS'
      else if (upperDesc.includes('AVE')) seg = 'AVES'
      else seg = 'OUTRO'
    }

    // Vendedor canônico
    const rawVend = (r.vendedor || factory?.vendedor_name || '').trim()
    const vendedor = normalizeSellerName(rawVend) || 'Não Atribuído'

    unified.push({
      id: r.id,
      data: dataStr,
      clienteNome: cNome || 'Cliente não identificado',
      clienteCodigo: cCod,
      produtoCodigo: pCod,
      produtoDescricao: pDesc || pCod || 'Item Comercial',
      familia: fam,
      valorBrl: val,
      uf,
      segmento: seg,
      vendedor,
    })
  }

  // Complementa com historico_vendas se faturamento for escasso
  if (unified.length === 0 || fatRows.length < 5) {
    for (const h of histRows) {
      const dataStr = toYmd(h.data_documento || h.data || h.created)
      const val = Number(h.produto_valor_total || h.valor || h.valor_total_nota || 0)
      const cNome = (h.destinatario_nome || h.cliente || '').trim()
      const pCod = (h.produto_codigo || '').trim()
      const pDesc = (h.produto_descricao || '').trim()
      const fam = familiaCompleta(pCod, h.produto_familia)
      const uf = (h.destinatario_uf || '').trim().toUpperCase() || 'N/I'

      let seg = (h.especie_destino || h.especie || '').trim().toUpperCase()
      if (seg === 'BOVINO' || seg === 'BOVINOS') seg = 'RUMINANTES'
      else if (seg === 'SUINO') seg = 'SUINOS'
      else if (seg === 'AVE') seg = 'AVES'
      else if (seg === 'PET') seg = 'PETS'
      else if (!seg) seg = 'OUTRO'

      const rawVend = (h.vendedor || '').trim()
      const vendedor = normalizeSellerName(rawVend) || 'Não Atribuído'

      unified.push({
        id: h.id,
        data: dataStr,
        clienteNome: cNome || 'Cliente não identificado',
        produtoCodigo: pCod,
        produtoDescricao: pDesc || pCod || 'Item Comercial',
        familia: fam,
        valorBrl: val,
        uf,
        segmento: seg,
        vendedor,
      })
    }
  }

  // 3. Aplicar Filtros
  const filtered = unified.filter((row) => {
    // Período
    if (filtros.dataInicio && row.data && row.data < filtros.dataInicio) return false
    if (filtros.dataFim && row.data && row.data > filtros.dataFim) return false

    // Segmentos multi-select
    if (filtros.segmentos && filtros.segmentos.length > 0) {
      const match = filtros.segmentos.some((s) => s.toUpperCase() === row.segmento.toUpperCase())
      if (!match) return false
    }

    // Vendedor
    if (filtros.vendedor && filtros.vendedor !== 'all') {
      const target = normalizeSellerName(filtros.vendedor).toLowerCase()
      if (row.vendedor.toLowerCase() !== target) return false
    }

    // Estado
    if (filtros.estado && filtros.estado !== 'all') {
      if (row.uf.toUpperCase() !== filtros.estado.toUpperCase()) return false
    }

    return true
  })

  // 4. Agregações e Cálculos
  const totalFaturado = filtered.reduce((acc, r) => acc + (r.valorBrl || 0), 0)
  const totalRegistros = filtered.length
  const ticketMedio = totalRegistros > 0 ? totalFaturado / totalRegistros : 0

  // Clientes ativos
  const clientesAtivosSet = new Set<string>()
  for (const r of filtered) {
    if (r.clienteNome) clientesAtivosSet.add(r.clienteNome.toLowerCase())
  }
  const totalClientesAtivos = clientesAtivosSet.size

  // Vendas por Cliente
  const clienteMap = new Map<
    string,
    {
      nome: string
      codigo?: string
      uf: string
      segmento: string
      vendedor: string
      total: number
      count: number
    }
  >()
  for (const r of filtered) {
    const key = r.clienteNome
    if (!clienteMap.has(key)) {
      clienteMap.set(key, {
        nome: r.clienteNome,
        codigo: r.clienteCodigo,
        uf: r.uf,
        segmento: r.segmento,
        vendedor: r.vendedor,
        total: 0,
        count: 0,
      })
    }
    const c = clienteMap.get(key)!
    c.total += r.valorBrl
    c.count += 1
  }

  const vendasPorCliente: ClienteVendaLinha[] = Array.from(clienteMap.values())
    .sort((a, b) => b.total - a.total)
    .map((c, idx) => ({
      posicao: idx + 1,
      nome: c.nome,
      codigo: c.codigo,
      uf: c.uf,
      segmento: c.segmento,
      vendedor: c.vendedor,
      totalFaturado: c.total,
      participacaoPercent: totalFaturado > 0 ? (c.total / totalFaturado) * 100 : 0,
      qtdNotas: c.count,
    }))

  // Vendas por Segmento
  const segMap = new Map<string, { total: number; count: number }>()
  for (const r of filtered) {
    const s = r.segmento || 'OUTRO'
    if (!segMap.has(s)) segMap.set(s, { total: 0, count: 0 })
    const curr = segMap.get(s)!
    curr.total += r.valorBrl
    curr.count += 1
  }
  const vendasPorSegmento: SegmentoVendaLinha[] = Array.from(segMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([seg, stat]) => ({
      segmento: seg,
      totalFaturado: stat.total,
      participacaoPercent: totalFaturado > 0 ? (stat.total / totalFaturado) * 100 : 0,
      qtdNotas: stat.count,
    }))

  // Vendas por Estado
  const ufMap = new Map<string, { total: number; count: number }>()
  for (const r of filtered) {
    const u = r.uf || 'N/I'
    if (!ufMap.has(u)) ufMap.set(u, { total: 0, count: 0 })
    const curr = ufMap.get(u)!
    curr.total += r.valorBrl
    curr.count += 1
  }
  const vendasPorEstado: EstadoVendaLinha[] = Array.from(ufMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([uf, stat]) => ({
      estado: uf,
      totalFaturado: stat.total,
      participacaoPercent: totalFaturado > 0 ? (stat.total / totalFaturado) * 100 : 0,
      qtdNotas: stat.count,
    }))

  // Evolução Mensal
  const mesMap = new Map<string, { total: number; count: number }>()
  for (const r of filtered) {
    if (!r.data) continue
    const anoMes = r.data.slice(0, 7)
    if (!mesMap.has(anoMes)) mesMap.set(anoMes, { total: 0, count: 0 })
    const curr = mesMap.get(anoMes)!
    curr.total += r.valorBrl
    curr.count += 1
  }
  const sortedAnoMes = Array.from(mesMap.keys()).sort()
  const evolucaoMensal: EvolucaoMensalLinha[] = []
  let prevTotal: number | null = null

  for (const anoMes of sortedAnoMes) {
    const stat = mesMap.get(anoMes)!
    const [yyyy, mm] = anoMes.split('-')
    const mesIndex = parseInt(mm, 10) - 1
    const mesNome = MESES_NOMES[mesIndex] || mm
    const label = `${mesNome}/${yyyy}`

    let variacaoAnteriorPercent: number | null = null
    if (prevTotal !== null && prevTotal > 0) {
      variacaoAnteriorPercent = ((stat.total - prevTotal) / prevTotal) * 100
    }

    evolucaoMensal.push({
      anoMes,
      label,
      totalFaturado: stat.total,
      qtdNotas: stat.count,
      ticketMedio: stat.count > 0 ? stat.total / stat.count : 0,
      variacaoAnteriorPercent,
    })

    prevTotal = stat.total
  }

  // Top Produtos
  const prodMap = new Map<
    string,
    { codigo: string; descricao: string; familia: string; total: number; count: number }
  >()
  for (const r of filtered) {
    const key = `${r.produtoDescricao} — ${r.familia}`
    if (!prodMap.has(key)) {
      prodMap.set(key, {
        codigo: r.produtoCodigo,
        descricao: r.produtoDescricao,
        familia: r.familia,
        total: 0,
        count: 0,
      })
    }
    const curr = prodMap.get(key)!
    curr.total += r.valorBrl
    curr.count += 1
  }
  const topProdutos: TopProdutoLinha[] = Array.from(prodMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 20)
    .map((p, idx) => ({
      posicao: idx + 1,
      codigo: p.codigo,
      descricao: p.descricao,
      familia: p.familia,
      totalFaturado: p.total,
      participacaoPercent: totalFaturado > 0 ? (p.total / totalFaturado) * 100 : 0,
      qtdNotas: p.count,
    }))

  const periodoLabel = `${formatDataBR(filtros.dataInicio)} até ${formatDataBR(filtros.dataFim)}`

  return {
    geradoEm: new Date().toISOString(),
    periodoLabel,
    filtros: { ...filtros },
    secoes: [...secoes],
    formato,
    totalFaturado,
    totalRegistros,
    ticketMedio,
    totalClientesAtivos,
    vendasPorCliente,
    vendasPorSegmento,
    vendasPorEstado,
    evolucaoMensal,
    topProdutos,
  }
}

/**
 * Salva o relatório gerado na coleção relatorios_gerados e notifica Realtime
 */
export async function salvarRelatorioGerado(
  calculado: RelatorioVendasCalculado,
): Promise<RelatorioGeradoRecord> {
  const userId = pb.authStore.record?.id
  if (!userId) {
    throw new Error('Usuário não autenticado.')
  }

  const record = await pb.collection('relatorios_gerados').create<RelatorioGeradoRecord>({
    user_id: userId,
    periodo: calculado.periodoLabel,
    filtros: JSON.stringify(calculado.filtros),
    conteudo: JSON.stringify({
      secoes: calculado.secoes,
      totalFaturado: calculado.totalFaturado,
      totalRegistros: calculado.totalRegistros,
      ticketMedio: calculado.ticketMedio,
      totalClientesAtivos: calculado.totalClientesAtivos,
    }),
    formato: calculado.formato,
  })

  // Dispara notificação local/realtime do ecossistema do app
  notifyDataChanged('relatorios_gerados')

  return record
}

/**
 * Lista os últimos 20 relatórios gerados pelo usuário autenticado
 */
export async function listarHistoricoRelatorios(limit = 20): Promise<RelatorioGeradoRecord[]> {
  try {
    const list = await pb
      .collection('relatorios_gerados')
      .getList<RelatorioGeradoRecord>(1, limit, {
        sort: '-created',
      })
    return list.items
  } catch (err) {
    console.warn('[relatorios_gerados] list error:', err)
    return []
  }
}

/**
 * Exporta o relatório de vendas em Excel (.xlsx) com o nome relatorio-vendas-YYYY-MM-DD.xlsx
 */
export function exportarRelatorioVendasExcel(report: RelatorioVendasCalculado): void {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const fileName = `relatorio-vendas-${yyyy}-${mm}-${dd}.xlsx`

  const wb = XLSX.utils.book_new()

  // 1. Resumo Executivo
  if (report.secoes.includes('resumo_executivo')) {
    const rowsResumo: (string | number)[][] = [
      ['Blink Biotech — Relatório de Vendas'],
      ['Demonstrativo Comercial de Vendas B2B'],
      [`Período de Referência: ${report.periodoLabel}`],
      [`Data de Geração: ${formatDataBR(now)}`],
      [''],
      ['INDICADOR', 'VALOR'],
      ['Total Faturado', formatMoedaBRL(report.totalFaturado)],
      ['Total de Lançamentos / Notas', report.totalRegistros],
      ['Ticket Médio', formatMoedaBRL(report.ticketMedio)],
      ['Clientes Ativos com Compras', report.totalClientesAtivos],
    ]
    const wsResumo = XLSX.utils.aoa_to_sheet(rowsResumo)
    wsResumo['!cols'] = [{ wch: 35 }, { wch: 25 }]
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo')
  }

  // 2. Vendas por Cliente
  if (report.secoes.includes('vendas_por_cliente')) {
    const rowsCliente: (string | number)[][] = [
      [
        'Posição',
        'Cliente',
        'Código',
        'UF',
        'Segmento',
        'Vendedor',
        'Total Faturado (R$)',
        'Participação (%)',
        'Qtd Notas',
      ],
      ...report.vendasPorCliente.map((c) => [
        c.posicao,
        c.nome,
        c.codigo || '—',
        c.uf,
        c.segmento,
        c.vendedor,
        c.totalFaturado,
        formatPercentBR(c.participacaoPercent),
        c.qtdNotas,
      ]),
    ]
    const wsCliente = XLSX.utils.aoa_to_sheet(rowsCliente)
    wsCliente['!cols'] = [
      { wch: 10 },
      { wch: 35 },
      { wch: 15 },
      { wch: 8 },
      { wch: 16 },
      { wch: 22 },
      { wch: 20 },
      { wch: 16 },
      { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, wsCliente, 'Vendas por Cliente')
  }

  // 3. Vendas por Segmento
  if (report.secoes.includes('vendas_por_segmento')) {
    const rowsSeg: (string | number)[][] = [
      ['Segmento', 'Total Faturado (R$)', 'Participação (%)', 'Qtd Notas'],
      ...report.vendasPorSegmento.map((s) => [
        s.segmento,
        s.totalFaturado,
        formatPercentBR(s.participacaoPercent),
        s.qtdNotas,
      ]),
    ]
    const wsSeg = XLSX.utils.aoa_to_sheet(rowsSeg)
    wsSeg['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsSeg, 'Vendas por Segmento')
  }

  // 4. Vendas por Estado
  if (report.secoes.includes('vendas_por_estado')) {
    const rowsEst: (string | number)[][] = [
      ['Estado (UF)', 'Total Faturado (R$)', 'Participação (%)', 'Qtd Notas'],
      ...report.vendasPorEstado.map((e) => [
        e.estado,
        e.totalFaturado,
        formatPercentBR(e.participacaoPercent),
        e.qtdNotas,
      ]),
    ]
    const wsEst = XLSX.utils.aoa_to_sheet(rowsEst)
    wsEst['!cols'] = [{ wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, wsEst, 'Vendas por Estado')
  }

  // 5. Evolução Mensal
  if (report.secoes.includes('evolucao_mensal')) {
    const rowsEvol: (string | number)[][] = [
      ['Mês/Ano', 'Total Faturado (R$)', 'Qtd Notas', 'Ticket Médio (R$)', 'Variação Anterior (%)'],
      ...report.evolucaoMensal.map((m) => [
        m.label,
        m.totalFaturado,
        m.qtdNotas,
        m.ticketMedio,
        m.variacaoAnteriorPercent !== null ? formatPercentBR(m.variacaoAnteriorPercent) : '—',
      ]),
    ]
    const wsEvol = XLSX.utils.aoa_to_sheet(rowsEvol)
    wsEvol['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, wsEvol, 'Evolução Mensal')
  }

  // 6. Top Produtos
  if (report.secoes.includes('top_produtos')) {
    const rowsProd: (string | number)[][] = [
      [
        'Posição',
        'Código',
        'Descrição do Produto',
        'Família',
        'Total Faturado (R$)',
        'Participação (%)',
        'Qtd Notas',
      ],
      ...report.topProdutos.map((p) => [
        p.posicao,
        p.codigo || '—',
        p.descricao,
        p.familia,
        p.totalFaturado,
        formatPercentBR(p.participacaoPercent),
        p.qtdNotas,
      ]),
    ]
    const wsProd = XLSX.utils.aoa_to_sheet(rowsProd)
    wsProd['!cols'] = [
      { wch: 10 },
      { wch: 16 },
      { wch: 32 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, wsProd, 'Top Produtos')
  }

  XLSX.writeFile(wb, fileName)
}

/**
 * Emite o PDF corporativo padrão executivo da Blink Biotech
 * Nome do documento impresso: relatorio-vendas-YYYY-MM-DD.pdf
 */
export function exportarRelatorioVendasPDF(report: RelatorioVendasCalculado): boolean {
  const sections: PdfSection[] = []
  let secIndex = 1

  if (report.secoes.includes('resumo_executivo')) {
    sections.push({
      numero: secIndex++,
      titulo: 'Resumo Executivo',
      descricao:
        'Indicadores principais consolidados de faturamento, volume de notas e clientes com compras.',
      kpis: [
        {
          label: 'Total Faturado',
          valor: formatMoedaBRL(report.totalFaturado),
          sub: 'Receita comercial do período',
          accent: 'primary',
        },
        {
          label: 'Lançamentos / Notas',
          valor: String(report.totalRegistros),
          sub: 'Operações registradas',
          accent: 'amber',
        },
        {
          label: 'Ticket Médio',
          valor: formatMoedaBRL(report.ticketMedio),
          sub: 'Média por lançamento',
          accent: 'emerald',
        },
        {
          label: 'Clientes Ativos',
          valor: String(report.totalClientesAtivos),
          sub: 'Compras no período',
          accent: 'sky',
        },
      ],
    })
  }

  if (report.secoes.includes('vendas_por_cliente')) {
    sections.push({
      numero: secIndex++,
      titulo: 'Vendas por Cliente',
      descricao: 'Relação dos clientes ordenados por volume faturado no período analisado.',
      table: {
        columns: [
          { header: 'Pos.', width: '50px', align: 'center', isBold: true },
          { header: 'Cliente', align: 'left' },
          { header: 'UF', width: '50px', align: 'center' },
          { header: 'Segmento', width: '110px', align: 'left' },
          { header: 'Vendedor', width: '130px', align: 'left' },
          { header: 'Participação (%)', width: '120px', align: 'right' },
          { header: 'Total Faturado (R$)', width: '160px', align: 'right', isBold: true },
        ],
        rows: report.vendasPorCliente
          .slice(0, 30)
          .map((c) => [
            `${c.posicao}º`,
            c.nome,
            c.uf || '—',
            c.segmento || '—',
            c.vendedor || '—',
            formatPercentBR(c.participacaoPercent),
            formatMoedaBRL(c.totalFaturado),
          ]),
        footerRow: [
          'TOTAL:',
          `${report.vendasPorCliente.length} clientes`,
          '',
          '',
          '',
          '100,0%',
          formatMoedaBRL(report.totalFaturado),
        ],
        emptyMessage: 'Nenhuma venda registrada para clientes no período.',
      },
    })
  }

  if (report.secoes.includes('vendas_por_segmento')) {
    sections.push({
      numero: secIndex++,
      titulo: 'Vendas por Segmento',
      descricao: 'Distribuição comercial da receita entre os segmentos atendidos.',
      table: {
        columns: [
          { header: 'Segmento Comercial', align: 'left', isBold: true },
          { header: 'Qtd Notas', width: '100px', align: 'center' },
          { header: 'Participação (%)', width: '150px', align: 'right' },
          { header: 'Total Faturado (R$)', width: '180px', align: 'right', isBold: true },
        ],
        rows: report.vendasPorSegmento.map((s) => [
          s.segmento,
          String(s.qtdNotas),
          formatPercentBR(s.participacaoPercent),
          formatMoedaBRL(s.totalFaturado),
        ]),
        footerRow: [
          'TOTAL:',
          String(report.totalRegistros),
          '100,0%',
          formatMoedaBRL(report.totalFaturado),
        ],
        emptyMessage: 'Nenhum segmento registrado.',
      },
    })
  }

  if (report.secoes.includes('vendas_por_estado')) {
    sections.push({
      numero: secIndex++,
      titulo: 'Vendas por Estado',
      descricao: 'Distribuição regional de vendas por Unidade Federativa (UF).',
      table: {
        columns: [
          { header: 'Estado (UF)', width: '120px', align: 'center', isBold: true },
          { header: 'Qtd Notas', width: '120px', align: 'center' },
          { header: 'Participação (%)', width: '160px', align: 'right' },
          { header: 'Total Faturado (R$)', width: '180px', align: 'right', isBold: true },
        ],
        rows: report.vendasPorEstado.map((e) => [
          e.estado,
          String(e.qtdNotas),
          formatPercentBR(e.participacaoPercent),
          formatMoedaBRL(e.totalFaturado),
        ]),
        footerRow: [
          'TOTAL:',
          String(report.totalRegistros),
          '100,0%',
          formatMoedaBRL(report.totalFaturado),
        ],
        emptyMessage: 'Nenhum estado registrado.',
      },
    })
  }

  if (report.secoes.includes('evolucao_mensal')) {
    sections.push({
      numero: secIndex++,
      titulo: 'Evolução Mensal',
      descricao: 'Evolução cronológica de receita, ticket médio e variação percentual mês a mês.',
      table: {
        columns: [
          { header: 'Mês/Ano', width: '140px', align: 'left', isBold: true },
          { header: 'Qtd Notas', width: '90px', align: 'center' },
          { header: 'Ticket Médio (R$)', width: '140px', align: 'right' },
          { header: 'Variação (%)', width: '120px', align: 'right' },
          { header: 'Total Faturado (R$)', width: '170px', align: 'right', isBold: true },
        ],
        rows: report.evolucaoMensal.map((m) => [
          m.label,
          String(m.qtdNotas),
          formatMoedaBRL(m.ticketMedio),
          m.variacaoAnteriorPercent !== null
            ? `${m.variacaoAnteriorPercent >= 0 ? '+' : ''}${formatPercentBR(m.variacaoAnteriorPercent)}`
            : '—',
          formatMoedaBRL(m.totalFaturado),
        ]),
        footerRow: [
          'TOTAL ACUMULADO:',
          String(report.totalRegistros),
          formatMoedaBRL(report.ticketMedio),
          '—',
          formatMoedaBRL(report.totalFaturado),
        ],
        emptyMessage: 'Nenhuma evolução mensal disponível.',
      },
    })
  }

  if (report.secoes.includes('top_produtos')) {
    sections.push({
      numero: secIndex++,
      titulo: 'Top Produtos',
      descricao: 'Produtos de maior faturamento e representatividade financeira no período.',
      table: {
        columns: [
          { header: 'Pos.', width: '50px', align: 'center', isBold: true },
          { header: 'Descrição do Produto', align: 'left' },
          { header: 'Família', width: '140px', align: 'left' },
          { header: 'Qtd Notas', width: '90px', align: 'center' },
          { header: 'Participação (%)', width: '120px', align: 'right' },
          { header: 'Total Faturado (R$)', width: '160px', align: 'right', isBold: true },
        ],
        rows: report.topProdutos.map((p) => [
          `${p.posicao}º`,
          p.descricao,
          p.familia,
          String(p.qtdNotas),
          formatPercentBR(p.participacaoPercent),
          formatMoedaBRL(p.totalFaturado),
        ]),
        footerRow: [
          'TOP PRODUTOS:',
          `${report.topProdutos.length} itens`,
          '',
          '',
          formatPercentBR(report.topProdutos.reduce((acc, p) => acc + p.participacaoPercent, 0)),
          formatMoedaBRL(report.topProdutos.reduce((acc, p) => acc + p.totalFaturado, 0)),
        ],
        emptyMessage: 'Nenhum produto registrado no período.',
      },
    })
  }

  const segmentosTexto =
    report.filtros.segmentos && report.filtros.segmentos.length > 0
      ? report.filtros.segmentos.join(', ')
      : 'Todos os segmentos'

  return openCorporatePdfReport({
    titulo: 'Relatório de Vendas',
    subtitulo: 'Demonstrativo Comercial de Vendas B2B — Blink Biotech',
    origem: 'Aba Relatório de Vendas (/relatorio-vendas)',
    periodo: report.periodoLabel,
    filtros: {
      Período: report.periodoLabel,
      Segmentos: segmentosTexto,
      Vendedor: report.filtros.vendedor !== 'all' ? report.filtros.vendedor : 'Todos os vendedores',
      'Estado (UF)': report.filtros.estado !== 'all' ? report.filtros.estado : 'Todos os estados',
    },
    sections,
    orientacao: 'portrait',
  })
}
