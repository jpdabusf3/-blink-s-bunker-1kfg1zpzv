import pb from '@/lib/pocketbase/client'
import { familiaCompleta } from '@/constants/familiaProdutos'
import {
  openCorporatePdfReport,
  formatMoedaBRL,
  formatPercentBR,
  formatDataBR,
  formatDataHoraBR,
  type PdfSection,
} from '@/lib/corporateDocuments'

export interface SalesReportFilters {
  dataInicio: string // YYYY-MM-DD
  dataFim: string // YYYY-MM-DD
  segmentos: string[] // 'AVES' | 'PETS' | 'RUMINANTES' | 'SUINOS' | 'AQUA'
  clienteId: string // 'all' or client name / ID
  familiaProduto: string // 'all' or family name
  uf: string // 'all' or state UF
}

export interface MesComparativoItem {
  anoMes: string // YYYY-MM
  label: string // Mês/AAAA (ex: "Janeiro/2026")
  totalFaturado: number
  totalNotas: number
  ticketMedio: number
  variacaoAnteriorPercent: number | null
}

export interface TopClienteItem {
  posicao: number
  nome: string
  totalFaturado: number
  participacaoPercent: number
  uf?: string
  segmento?: string
}

export interface TopProdutoFamiliaItem {
  posicao: number
  nome: string
  familia: string
  totalFaturado: number
  participacaoPercent: number
}

export interface DistribuicaoItem {
  nome: string
  totalFaturado: number
  participacaoPercent: number
  quantidade: number
}

export interface GeneratedSalesReportData {
  id?: string
  filtros: SalesReportFilters
  geradoEm: string
  geradoPor: string
  totalFaturado: number
  totalRegistros: number
  ticketMedio: number
  mesAMes: MesComparativoItem[]
  topClientes: TopClienteItem[]
  topProdutos: TopProdutoFamiliaItem[]
  distribuicaoSegmento: DistribuicaoItem[]
  distribuicaoUf: DistribuicaoItem[]
}

export interface SalesReportHistoryItem {
  id: string
  title: string
  created: string
  periodoInicio: string
  periodoFim: string
  totalFaturado: number
  dataPayload?: GeneratedSalesReportData
  documentId?: string
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
 * Normaliza datas diversas (YYYY-MM-DD, ISO, etc.) para "YYYY-MM-DD"
 */
function toDateStr(val?: string | null): string {
  if (!val) return ''
  const str = String(val).trim()
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10)
  }
  const d = new Date(val)
  if (isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Agrupa faturamento e histórico_vendas aplicando os filtros
 */
export async function generateSalesReport(
  filters: SalesReportFilters,
  factoriesCache?: any[],
): Promise<GeneratedSalesReportData> {
  // 1. Carregar fábricas/clientes caso não venham em cache
  let factoriesList = factoriesCache || []
  if (!factoriesList || factoriesList.length === 0) {
    try {
      factoriesList = await pb.collection('factories').getFullList({
        filter: 'is_deleted != true',
        fields: 'id,name,state,carteira,codigo_cliente,cnpj',
      })
    } catch {
      factoriesList = []
    }
  }

  // Mapa de cliente por nome normalizado e código
  const factoryByName = new Map<string, any>()
  const factoryByCode = new Map<string, any>()
  for (const f of factoriesList) {
    if (f.name) factoryByName.set(f.name.toLowerCase().trim(), f)
    if (f.codigo_cliente) factoryByCode.set(f.codigo_cliente.toUpperCase().trim(), f)
  }

  // 2. Carregar registros de faturamento
  let faturamentoRows: any[] = []
  try {
    faturamentoRows = await pb.collection('faturamento').getFullList({
      sort: 'data_documento',
    })
  } catch (err) {
    console.warn('[sales-report] faturamento read error:', err)
    faturamentoRows = []
  }

  // 3. Carregar registros de historico_vendas para complementar dados se necessário
  let historicoRows: any[] = []
  try {
    historicoRows = await pb.collection('historico_vendas').getFullList({
      sort: 'data_documento',
    })
  } catch (err) {
    console.warn('[sales-report] historico_vendas read error:', err)
    historicoRows = []
  }

  // 4. Unificar em uma linha canônica
  interface RawSaleItem {
    id: string
    origem: 'faturamento' | 'historico_vendas'
    data: string // YYYY-MM-DD
    clienteNome: string
    clienteCodigo?: string
    produtoCodigo: string
    produtoDescricao: string
    familia: string
    valorBrl: number
    uf: string
    segmento: string // AVES | PETS | RUMINANTES | SUINOS | AQUA | OUTRO
  }

  const unifiedSales: RawSaleItem[] = []

  // Preenche a partir de faturamento
  for (const r of faturamentoRows) {
    const dataStr = toDateStr(r.data_documento || r.created)
    const val = Number(r.valor_brl || 0)
    const cNome = (r.cliente_nome || '').trim()
    const cCod = (r.cliente_codigo || '').trim()
    const pCod = (r.produto_codigo || '').trim()
    const pDesc = (r.produto_descricao || '').trim()
    const fam = familiaCompleta(pCod, r.familia_produto)

    // Lookup fábrica para UF e Segmento
    let factory = cCod ? factoryByCode.get(cCod.toUpperCase()) : undefined
    if (!factory && cNome) {
      factory = factoryByName.get(cNome.toLowerCase())
    }

    const uf = (factory?.state || r.country || '').trim().toUpperCase()
    let seg = (factory?.carteira || '').trim().toUpperCase()
    if (!seg || seg === 'NONE') {
      // Tentar inferir de produto ou padrão OUTRO
      if (pDesc.toUpperCase().includes('PET')) seg = 'PETS'
      else if (pDesc.toUpperCase().includes('BOVINO') || pDesc.toUpperCase().includes('RUMINANTE'))
        seg = 'RUMINANTES'
      else if (pDesc.toUpperCase().includes('SUINO')) seg = 'SUINOS'
      else if (pDesc.toUpperCase().includes('AVE')) seg = 'AVES'
      else if (pDesc.toUpperCase().includes('AQUA')) seg = 'AQUA'
      else seg = 'OUTRO'
    }

    unifiedSales.push({
      id: r.id,
      origem: 'faturamento',
      data: dataStr,
      clienteNome: cNome || 'Cliente não identificado',
      clienteCodigo: cCod,
      produtoCodigo: pCod,
      produtoDescricao: pDesc || pCod || 'Item',
      familia: fam,
      valorBrl: val,
      uf: uf || 'N/I',
      segmento: seg,
    })
  }

  // Se a tabela faturamento estiver vazia ou com poucos dados, mesclar historico_vendas
  if (unifiedSales.length === 0 || faturamentoRows.length < 5) {
    for (const h of historicoRows) {
      const dataStr = toDateStr(h.data_documento || h.data || h.created)
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

      unifiedSales.push({
        id: h.id,
        origem: 'historico_vendas',
        data: dataStr,
        clienteNome: cNome || 'Cliente não identificado',
        produtoCodigo: pCod,
        produtoDescricao: pDesc || pCod || 'Item',
        familia: fam,
        valorBrl: val,
        uf,
        segmento: seg,
      })
    }
  }

  // 5. Aplicar os Filtros
  const filtered = unifiedSales.filter((item) => {
    // Filtro de Período (Start & End)
    if (filters.dataInicio && item.data && item.data < filters.dataInicio) {
      return false
    }
    if (filters.dataFim && item.data && item.data > filters.dataFim) {
      return false
    }

    // Filtro de Segmento (Multi-select)
    if (filters.segmentos && filters.segmentos.length > 0) {
      // Se tiver selecionado segmentos específicos e o item não pertencer
      const hasMatch = filters.segmentos.some(
        (seg) => seg.toUpperCase() === item.segmento.toUpperCase(),
      )
      if (!hasMatch) return false
    }

    // Filtro de Cliente
    if (filters.clienteId && filters.clienteId !== 'all') {
      const target = filters.clienteId.toLowerCase().trim()
      const matchesNome = item.clienteNome.toLowerCase().includes(target)
      const matchesCod = (item.clienteCodigo || '').toLowerCase() === target
      if (!matchesNome && !matchesCod) return false
    }

    // Filtro de Família / Produto
    if (filters.familiaProduto && filters.familiaProduto !== 'all') {
      const target = filters.familiaProduto.toLowerCase().trim()
      const matchesFam = item.familia.toLowerCase() === target
      const matchesProd = item.produtoDescricao.toLowerCase().includes(target)
      if (!matchesFam && !matchesProd) return false
    }

    // Filtro de UF
    if (filters.uf && filters.uf !== 'all') {
      if (item.uf.toUpperCase() !== filters.uf.toUpperCase()) return false
    }

    return true
  })

  // Se não houver dados, retorna estrutura zerada
  const totalFaturado = filtered.reduce((acc, i) => acc + (i.valorBrl || 0), 0)
  const totalRegistros = filtered.length
  const ticketMedio = totalRegistros > 0 ? totalFaturado / totalRegistros : 0

  // 6. Comparativo Mês a Mês
  const mesMap = new Map<string, { totalFaturado: number; totalNotas: number }>()
  for (const item of filtered) {
    if (!item.data) continue
    const anoMes = item.data.slice(0, 7) // YYYY-MM
    if (!mesMap.has(anoMes)) {
      mesMap.set(anoMes, { totalFaturado: 0, totalNotas: 0 })
    }
    const curr = mesMap.get(anoMes)!
    curr.totalFaturado += item.valorBrl
    curr.totalNotas += 1
  }

  // Ordenar cronologicamente
  const sortedAnoMes = Array.from(mesMap.keys()).sort()
  const mesAMes: MesComparativoItem[] = []
  let prevTotal: number | null = null

  for (const anoMes of sortedAnoMes) {
    const stat = mesMap.get(anoMes)!
    const [yyyy, mm] = anoMes.split('-')
    const mesIndex = parseInt(mm, 10) - 1
    const mesNome = MESES_NOMES[mesIndex] || mm
    const label = `${mesNome}/${yyyy}`

    let variacaoAnteriorPercent: number | null = null
    if (prevTotal !== null && prevTotal > 0) {
      variacaoAnteriorPercent = ((stat.totalFaturado - prevTotal) / prevTotal) * 100
    }

    mesAMes.push({
      anoMes,
      label,
      totalFaturado: stat.totalFaturado,
      totalNotas: stat.totalNotas,
      ticketMedio: stat.totalNotas > 0 ? stat.totalFaturado / stat.totalNotas : 0,
      variacaoAnteriorPercent,
    })

    prevTotal = stat.totalFaturado
  }

  // 7. Top 10 Clientes
  const clienteMap = new Map<
    string,
    { nome: string; totalFaturado: number; uf?: string; segmento?: string }
  >()
  for (const item of filtered) {
    const key = item.clienteNome
    if (!clienteMap.has(key)) {
      clienteMap.set(key, {
        nome: item.clienteNome,
        totalFaturado: 0,
        uf: item.uf,
        segmento: item.segmento,
      })
    }
    clienteMap.get(key)!.totalFaturado += item.valorBrl
  }

  const topClientes: TopClienteItem[] = Array.from(clienteMap.values())
    .sort((a, b) => b.totalFaturado - a.totalFaturado)
    .slice(0, 10)
    .map((c, idx) => ({
      posicao: idx + 1,
      nome: c.nome,
      totalFaturado: c.totalFaturado,
      participacaoPercent: totalFaturado > 0 ? (c.totalFaturado / totalFaturado) * 100 : 0,
      uf: c.uf,
      segmento: c.segmento,
    }))

  // 8. Top 10 Produtos / Famílias
  const prodMap = new Map<string, { nome: string; familia: string; totalFaturado: number }>()
  for (const item of filtered) {
    const key = `${item.produtoDescricao} — ${item.familia}`
    if (!prodMap.has(key)) {
      prodMap.set(key, {
        nome: item.produtoDescricao,
        familia: item.familia,
        totalFaturado: 0,
      })
    }
    prodMap.get(key)!.totalFaturado += item.valorBrl
  }

  const topProdutos: TopProdutoFamiliaItem[] = Array.from(prodMap.values())
    .sort((a, b) => b.totalFaturado - a.totalFaturado)
    .slice(0, 10)
    .map((p, idx) => ({
      posicao: idx + 1,
      nome: p.nome,
      familia: p.familia,
      totalFaturado: p.totalFaturado,
      participacaoPercent: totalFaturado > 0 ? (p.totalFaturado / totalFaturado) * 100 : 0,
    }))

  // 9. Distribuição por Segmento
  const segMap = new Map<string, { totalFaturado: number; quantidade: number }>()
  for (const item of filtered) {
    const s = item.segmento || 'OUTRO'
    if (!segMap.has(s)) {
      segMap.set(s, { totalFaturado: 0, quantidade: 0 })
    }
    const curr = segMap.get(s)!
    curr.totalFaturado += item.valorBrl
    curr.quantidade += 1
  }

  const distribuicaoSegmento: DistribuicaoItem[] = Array.from(segMap.entries())
    .map(([nome, stat]) => ({
      nome,
      totalFaturado: stat.totalFaturado,
      quantidade: stat.quantidade,
      participacaoPercent: totalFaturado > 0 ? (stat.totalFaturado / totalFaturado) * 100 : 0,
    }))
    .sort((a, b) => b.totalFaturado - a.totalFaturado)

  // 10. Distribuição por UF
  const ufMap = new Map<string, { totalFaturado: number; quantidade: number }>()
  for (const item of filtered) {
    const u = item.uf || 'N/I'
    if (!ufMap.has(u)) {
      ufMap.set(u, { totalFaturado: 0, quantidade: 0 })
    }
    const curr = ufMap.get(u)!
    curr.totalFaturado += item.valorBrl
    curr.quantidade += 1
  }

  const distribuicaoUf: DistribuicaoItem[] = Array.from(ufMap.entries())
    .map(([nome, stat]) => ({
      nome,
      totalFaturado: stat.totalFaturado,
      quantidade: stat.quantidade,
      participacaoPercent: totalFaturado > 0 ? (stat.totalFaturado / totalFaturado) * 100 : 0,
    }))
    .sort((a, b) => b.totalFaturado - a.totalFaturado)

  const userName =
    (pb.authStore.record as any)?.name || (pb.authStore.record as any)?.email || 'Diretoria Blink'

  return {
    filtros: { ...filters },
    geradoEm: new Date().toISOString(),
    geradoPor: userName,
    totalFaturado,
    totalRegistros,
    ticketMedio,
    mesAMes,
    topClientes,
    topProdutos,
    distribuicaoSegmento,
    distribuicaoUf,
  }
}

/**
 * Salva o relatório gerado nas collections de documentos / relatórios
 * mantendo compatibilidade com Relatórios Automáticos e Documentos
 */
export async function persistSalesReport(
  report: GeneratedSalesReportData,
): Promise<{ success: boolean; documentId?: string }> {
  try {
    const userId = pb.authStore.record?.id || ''
    const dataStamp = new Date().toISOString().slice(0, 10)
    const periodoLabel = `${formatDataBR(report.filtros.dataInicio || 'Início')} a ${formatDataBR(report.filtros.dataFim || 'Hoje')}`
    const fileName = `relatorio-vendas-${report.filtros.dataInicio || 'inicio'}_${report.filtros.dataFim || 'fim'}-${Date.now()}.json`

    // Cria JSON blob para arquivo
    const jsonStr = JSON.stringify(report, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const file = new File([blob], fileName, { type: 'application/json' })

    const form = new FormData()
    form.append('title', `Relatório de Vendas — ${periodoLabel}`)
    form.append('category', 'Relatórios')
    form.append('min_access_level', 'Comum')
    form.append('nome_original', fileName)
    form.append('file', file)

    const docRecord = await pb.collection('documents').create(form)

    // Log de atividade
    try {
      await pb.collection('activity_logs').create({
        user: userId,
        action: `Relatório de Vendas Gerado: ${periodoLabel}`,
        details: `Relatório de vendas consolidado gerado. Total faturado: ${formatMoedaBRL(report.totalFaturado)} com ${report.totalRegistros} lançamentos.`,
        origem: 'painel',
        tipo: 'outro',
        target_collection: 'documents',
        recordId: docRecord.id,
      })
    } catch (_) {
      // ignore
    }

    return { success: true, documentId: docRecord.id }
  } catch (err) {
    console.warn('[sales-report] persist failed:', err)
    return { success: false }
  }
}

/**
 * Carrega histórico dos relatórios de vendas salvos
 */
export async function listSalesReportHistory(): Promise<SalesReportHistoryItem[]> {
  try {
    const docs = await pb.collection('documents').getList(1, 100, {
      filter:
        "title ~ 'Relatório de Vendas' || category = 'Relatórios' || nome_original ~ 'relatorio-vendas'",
      sort: '-created',
    })

    const history: SalesReportHistoryItem[] = []
    for (const doc of docs.items) {
      let dataPayload: GeneratedSalesReportData | undefined = undefined

      // Se for arquivo JSON, tenta ler os dados estruturados para reabrir
      if (doc.file && (doc.file.endsWith('.json') || (doc.nome_original || '').endsWith('.json'))) {
        try {
          const fileUrl = `${import.meta.env.VITE_POCKETBASE_URL}/api/files/documents/${doc.id}/${doc.file}`
          const res = await fetch(fileUrl, {
            headers: { Authorization: pb.authStore.token },
          })
          if (res.ok) {
            dataPayload = await res.json()
          }
        } catch {
          /* intentionally ignored */
        }
      }

      // Extrai período do título
      const title = doc.title || doc.nome_original || 'Relatório de Vendas'
      history.push({
        id: doc.id,
        title,
        created: doc.created,
        periodoInicio: dataPayload?.filtros?.dataInicio || '',
        periodoFim: dataPayload?.filtros?.dataFim || '',
        totalFaturado: dataPayload?.totalFaturado || 0,
        dataPayload,
        documentId: doc.id,
      })
    }

    return history
  } catch (err) {
    console.warn('[sales-report] list history error:', err)
    return []
  }
}

/**
 * Exporta o relatório como CSV padronizado em Português
 * Nome: relatorio-vendas-YYYY-MM-DD.csv
 */
export function exportSalesReportToCSV(report: GeneratedSalesReportData): void {
  const lines: string[] = []
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const dateStamp = `${yyyy}-${mm}-${dd}`
  const filename = `relatorio-vendas-${dateStamp}.csv`

  const periodoLabel = `${formatDataBR(report.filtros.dataInicio || 'Início')} até ${formatDataBR(report.filtros.dataFim || 'Hoje')}`

  // 1. Cabeçalho Institucional
  lines.push('"Blink Biotech — Bunker de Inteligência Comercial"')
  lines.push('"Relatório Consolidado de Vendas B2B"')
  lines.push(`"Período de Referência:";"${periodoLabel}"`)
  lines.push(`"Data e Hora de Geração:";"${formatDataHoraBR(now)}"`)
  lines.push(`"Gerado por:";"${report.geradoPor}"`)
  lines.push(
    `"Total Faturado no Período:";"${report.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`,
  )
  lines.push(`"Total de Lançamentos:";"${report.totalRegistros}"`)
  lines.push(
    `"Ticket Médio por Lançamento:";"${report.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`,
  )
  lines.push('')

  // 2. Comparativo Mês a Mês
  lines.push('"--- COMPARATIVO MÊS A MÊS ---"')
  lines.push(
    '"Mês/Ano";"Total Faturado (R$)";"Qtd Pedidos/Notas";"Ticket Médio (R$)";"Variação (%)"',
  )
  for (const m of report.mesAMes) {
    const fat = m.totalFaturado.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const tm = m.ticketMedio.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const varStr =
      m.variacaoAnteriorPercent !== null ? formatPercentBR(m.variacaoAnteriorPercent) : '—'
    lines.push(`"${m.label}";"${fat}";"${m.totalNotas}";"${tm}";"${varStr}"`)
  }
  lines.push('')

  // 3. Top 10 Clientes
  lines.push('"--- TOP 10 CLIENTES ---"')
  lines.push('"Posição";"Cliente";"UF";"Segmento";"Total Faturado (R$)";"Participação (%)"')
  for (const c of report.topClientes) {
    const fat = c.totalFaturado.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const part = formatPercentBR(c.participacaoPercent)
    lines.push(
      `"${c.posicao}º";"${c.nome.replace(/"/g, '""')}";"${c.uf || '—'}";"${c.segmento || '—'}";"${fat}";"${part}"`,
    )
  }
  lines.push('')

  // 4. Top 10 Produtos / Famílias
  lines.push('"--- TOP 10 PRODUTOS E FAMÍLIAS ---"')
  lines.push('"Posição";"Produto";"Família";"Total Faturado (R$)";"Participação (%)"')
  for (const p of report.topProdutos) {
    const fat = p.totalFaturado.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const part = formatPercentBR(p.participacaoPercent)
    lines.push(`"${p.posicao}º";"${p.nome.replace(/"/g, '""')}";"${p.familia}";"${fat}";"${part}"`)
  }
  lines.push('')

  // 5. Distribuição por Segmento
  lines.push('"--- DISTRIBUIÇÃO POR SEGMENTO ---"')
  lines.push('"Segmento";"Total Faturado (R$)";"Qtd Lançamentos";"Participação (%)"')
  for (const s of report.distribuicaoSegmento) {
    const fat = s.totalFaturado.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const part = formatPercentBR(s.participacaoPercent)
    lines.push(`"${s.nome}";"${fat}";"${s.quantidade}";"${part}"`)
  }
  lines.push('')

  // 6. Distribuição por UF
  lines.push('"--- DISTRIBUIÇÃO POR UF (ESTADO) ---"')
  lines.push('"UF";"Total Faturado (R$)";"Qtd Lançamentos";"Participação (%)"')
  for (const u of report.distribuicaoUf) {
    const fat = u.totalFaturado.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    const part = formatPercentBR(u.participacaoPercent)
    lines.push(`"${u.nome}";"${fat}";"${u.quantidade}";"${part}"`)
  }

  // Monta CSV com BOM UTF-8 para excel abrir sem erros de acentuação
  const csvContent = '\uFEFF' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Emite o PDF corporativo padrão executivo da Blink Biotech
 * com capa, KPIs, tabelas zebradas, sumário, rodapé com numeração de página e confidencialidade.
 */
export function exportSalesReportToPDF(report: GeneratedSalesReportData): boolean {
  const periodoLabel = `${formatDataBR(report.filtros.dataInicio || 'Início')} até ${formatDataBR(report.filtros.dataFim || 'Hoje')}`

  const segmentosFiltro =
    report.filtros.segmentos && report.filtros.segmentos.length > 0
      ? report.filtros.segmentos.join(', ')
      : 'Todos os segmentos'

  const sections: PdfSection[] = [
    // 1. Indicadores Gerais
    {
      numero: 1,
      titulo: 'Indicadores Gerais de Faturamento',
      descricao:
        'Síntese da receita comercial faturada no período selecionado, com volume total de notas/pedidos e ticket médio das operações.',
      kpis: [
        {
          label: 'Total Faturado no Período',
          valor: formatMoedaBRL(report.totalFaturado),
          sub: 'Receita comercial consolidada',
          accent: 'primary',
        },
        {
          label: 'Lançamentos / Pedidos',
          valor: String(report.totalRegistros),
          sub: 'Notas e pedidos faturados',
          accent: 'amber',
        },
        {
          label: 'Ticket Médio',
          valor: formatMoedaBRL(report.ticketMedio),
          sub: 'Média de faturamento por lançamento',
          accent: 'emerald',
        },
        {
          label: 'Segmentos Filtrados',
          valor:
            report.filtros.segmentos.length > 0
              ? `${report.filtros.segmentos.length} selecionado(s)`
              : 'Geral (Todos)',
          sub: segmentosFiltro,
          accent: 'sky',
        },
      ],
    },

    // 2. Comparativo Mês a Mês
    {
      numero: 2,
      titulo: 'Comparativo Mês a Mês de Faturamento',
      descricao:
        'Evolução cronológica mensal do faturamento realizado, quantidade de notas emitidas, ticket médio mensal e variação percentual frente ao mês anterior.',
      table: {
        columns: [
          { header: 'Mês de Referência', width: '160px', align: 'left', isBold: true },
          { header: 'Qtd Notas', width: '90px', align: 'center' },
          { header: 'Ticket Médio (R$)', width: '150px', align: 'right' },
          { header: 'Variação (%)', width: '120px', align: 'right' },
          { header: 'Total Faturado (R$)', width: '180px', align: 'right', isBold: true },
        ],
        rows: report.mesAMes.map((m) => [
          m.label,
          String(m.totalNotas),
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
        emptyMessage: 'Nenhum faturamento registrado no período selecionado.',
      },
    },

    // 3. Top 10 Clientes
    {
      numero: 3,
      titulo: 'Top 10 Clientes por Faturamento',
      descricao:
        'Relação dos 10 clientes com maior volume de faturamento comercial e representatividade percentual sobre a receita total no período.',
      table: {
        columns: [
          { header: 'Posição', width: '70px', align: 'center', isBold: true },
          { header: 'Razão Social / Nome do Cliente', align: 'left' },
          { header: 'UF', width: '60px', align: 'center' },
          { header: 'Segmento', width: '120px', align: 'left' },
          { header: 'Participação (%)', width: '130px', align: 'right' },
          { header: 'Faturamento Total (R$)', width: '180px', align: 'right', isBold: true },
        ],
        rows: report.topClientes.map((c) => [
          `${c.posicao}º`,
          c.nome,
          c.uf || '—',
          c.segmento || '—',
          formatPercentBR(c.participacaoPercent),
          formatMoedaBRL(c.totalFaturado),
        ]),
        footerRow: [
          'TOP 10 TOTAL:',
          `${report.topClientes.length} cliente(s)`,
          '',
          '',
          formatPercentBR(report.topClientes.reduce((acc, c) => acc + c.participacaoPercent, 0)),
          formatMoedaBRL(report.topClientes.reduce((acc, c) => acc + c.totalFaturado, 0)),
        ],
        emptyMessage: 'Nenhum cliente com faturamento registrado no período selecionado.',
      },
    },

    // 4. Top 10 Produtos / Famílias
    {
      numero: 4,
      titulo: 'Top 10 Produtos e Famílias',
      descricao:
        'Classificação dos 10 produtos e famílias com maior representatividade financeira no período de análise.',
      table: {
        columns: [
          { header: 'Posição', width: '70px', align: 'center', isBold: true },
          { header: 'Descrição do Produto', align: 'left' },
          { header: 'Família do Produto', width: '160px', align: 'left' },
          { header: 'Participação (%)', width: '130px', align: 'right' },
          { header: 'Faturamento Total (R$)', width: '180px', align: 'right', isBold: true },
        ],
        rows: report.topProdutos.map((p) => [
          `${p.posicao}º`,
          p.nome,
          p.familia,
          formatPercentBR(p.participacaoPercent),
          formatMoedaBRL(p.totalFaturado),
        ]),
        footerRow: [
          'TOP 10 PRODUTOS:',
          `${report.topProdutos.length} produto(s)`,
          '',
          formatPercentBR(report.topProdutos.reduce((acc, p) => acc + p.participacaoPercent, 0)),
          formatMoedaBRL(report.topProdutos.reduce((acc, p) => acc + p.totalFaturado, 0)),
        ],
        emptyMessage: 'Nenhum produto registrado no período selecionado.',
      },
    },

    // 5. Distribuição por Segmento
    {
      numero: 5,
      titulo: 'Distribuição do Faturamento por Segmento',
      descricao:
        'Divisão da receita comercial entre os segmentos atendidos (AVES, PETS, RUMINANTES, SUINOS, AQUA e outros).',
      table: {
        columns: [
          { header: 'Segmento Comercial', align: 'left', isBold: true },
          { header: 'Qtd Lançamentos', width: '130px', align: 'center' },
          { header: 'Participação Percentual', width: '180px', align: 'right' },
          { header: 'Faturamento Total (R$)', width: '190px', align: 'right', isBold: true },
        ],
        rows: report.distribuicaoSegmento.map((s) => [
          s.nome,
          String(s.quantidade),
          formatPercentBR(s.participacaoPercent),
          formatMoedaBRL(s.totalFaturado),
        ]),
        footerRow: [
          'TOTAL:',
          String(report.totalRegistros),
          '100,0%',
          formatMoedaBRL(report.totalFaturado),
        ],
        emptyMessage: 'Nenhum dado por segmento disponível.',
      },
    },

    // 6. Distribuição por UF (Estado)
    {
      numero: 6,
      titulo: 'Distribuição Geográfica por Estado (UF)',
      descricao:
        'Desempenho regional do faturamento comercial consolidado por Unidade da Federação de destino.',
      table: {
        columns: [
          { header: 'UF (Estado)', width: '120px', align: 'center', isBold: true },
          { header: 'Qtd Lançamentos', width: '140px', align: 'center' },
          { header: 'Participação Percentual', width: '180px', align: 'right' },
          { header: 'Faturamento Total (R$)', width: '190px', align: 'right', isBold: true },
        ],
        rows: report.distribuicaoUf.map((u) => [
          u.nome,
          String(u.quantidade),
          formatPercentBR(u.participacaoPercent),
          formatMoedaBRL(u.totalFaturado),
        ]),
        footerRow: [
          'TOTAL:',
          String(report.totalRegistros),
          '100,0%',
          formatMoedaBRL(report.totalFaturado),
        ],
        emptyMessage: 'Nenhum dado por UF disponível.',
      },
    },
  ]

  return openCorporatePdfReport({
    titulo: 'Relatório Executivo de Vendas',
    subtitulo:
      'Demonstrativo Comercial de Vendas B2B · Faturamento, Comparativo Mensal, Clientes, Produtos, Segmentos e Estados',
    origem: 'Módulo Relatório de Vendas (/relatorios)',
    periodo: periodoLabel,
    filtros: {
      'Período Analisado': periodoLabel,
      Segmentos: segmentosFiltro,
      Cliente:
        report.filtros.clienteId && report.filtros.clienteId !== 'all'
          ? report.filtros.clienteId
          : 'Todos os clientes',
      'Família / Produto':
        report.filtros.familiaProduto && report.filtros.familiaProduto !== 'all'
          ? report.filtros.familiaProduto
          : 'Todas as famílias',
      'Estado (UF)':
        report.filtros.uf && report.filtros.uf !== 'all' ? report.filtros.uf : 'Todos os estados',
    },
    sections,
    orientacao: 'portrait',
  })
}
