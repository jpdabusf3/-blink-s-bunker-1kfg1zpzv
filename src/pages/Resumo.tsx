import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  AlertCircle,
  Upload,
  Calendar,
  Sparkles,
  PieChart,
  Layers,
  Package,
} from 'lucide-react'
import { MaestroChatPanel } from '@/components/MaestroChatPanel'
import { formatCurrency, cn } from '@/lib/utils'
import { useGlobalData } from '@/store/GlobalDataProvider'
import type { FaturamentoRecord } from '@/services/resumo-vendas'
import type { PedidoCarteira } from '@/services/pedidos-carteira'
import type { PedidoRecord } from '@/services/gestao-pedidos'
import { SyncErrorBanner } from '@/components/SyncErrorBanner'
import { MetasVendedorSegmentoSection } from '@/components/MetasVendedorSegmentoSection'
import { AlertasCarteiraSection } from '@/components/dashboard/AlertasCarteiraSection'
import { TodayTasksWidget } from '@/components/dashboard/TodayTasksWidget'
import { WeeklyAgendaCard } from '@/components/dashboard/WeeklyAgendaCard'
import { CODIGO_CANONICO_ROTULO } from '@/constants/familiaProdutos'
export type PeriodType = 'mes' | 'trimestre' | 'ano' | 'personalizado'

const MONTH_NAMES = [
  '',
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

const MONTH_SHORT = [
  '',
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const SEGMENT_COLORS = [
  '#0284c7', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#64748b', // Slate
  '#06b6d4', // Cyan
]

/**
 * Resolução canônica de Família de Produtos Blink Biotech
 * Canônicos exigidos:
 * MI-XS (Blends), MO-BE (Mos/BetaLink), MY-CO (Mycolink), MI-OR (Minerais Orgânicos), MY-ST (Leveduras)
 */
function resolveCanonicalFamilia(
  codigoProduto?: string | null,
  rawFamilia?: string | null,
): {
  code: string
  label: string
} {
  const cod = String(codigoProduto || '')
    .trim()
    .toUpperCase()
  const raw = String(rawFamilia || '')
    .trim()
    .toUpperCase()

  // 1. Por prefixo do código do produto (padrão Blink)
  if (
    cod.startsWith('BBMI.XS') ||
    cod.startsWith('BPMI.XS') ||
    cod.startsWith('MI-XS') ||
    cod.startsWith('MI.XS')
  ) {
    return { code: 'MI-XS', label: 'Blends' }
  }
  if (
    cod.startsWith('BBMO.BE') ||
    cod.startsWith('BPMO.BE') ||
    cod.startsWith('MO-BE') ||
    cod.startsWith('MO.BE')
  ) {
    return { code: 'MO-BE', label: 'Mos/BetaLink' }
  }
  if (
    cod.startsWith('BBMY.CO') ||
    cod.startsWith('BPMY.CO') ||
    cod.startsWith('MY-CO') ||
    cod.startsWith('MY.CO')
  ) {
    return { code: 'MY-CO', label: 'Mycolink' }
  }
  if (
    cod.startsWith('BBMI.OR') ||
    cod.startsWith('BPMI.OR') ||
    cod.startsWith('MI-OR') ||
    cod.startsWith('MI.OR')
  ) {
    return { code: 'MI-OR', label: 'Minerais Orgânicos' }
  }
  if (
    cod.startsWith('BBMY.ST') ||
    cod.startsWith('BPMY.ST') ||
    cod.startsWith('MY-ST') ||
    cod.startsWith('MY.ST')
  ) {
    return { code: 'MY-ST', label: 'Leveduras' }
  }

  // 2. Por código ou nome de família informado
  if (raw === 'MI-XS' || raw === 'MI.XS' || raw === 'BLENDS') {
    return { code: 'MI-XS', label: 'Blends' }
  }
  if (
    raw === 'MO-BE' ||
    raw === 'MO.BE' ||
    raw === 'MOS/BETALINK' ||
    raw === 'PREBIÓTICOS' ||
    raw === 'ADITIVOS'
  ) {
    return { code: 'MO-BE', label: 'Mos/BetaLink' }
  }
  if (raw === 'MY-CO' || raw === 'MY.CO' || raw === 'MYCOLINK' || raw === 'ADSORVENTES') {
    return { code: 'MY-CO', label: 'Mycolink' }
  }
  if (raw === 'MI-OR' || raw === 'MI.OR' || raw.includes('MINERAIS')) {
    return { code: 'MI-OR', label: 'Minerais Orgânicos' }
  }
  if (
    raw === 'MY-ST' ||
    raw === 'MY.ST' ||
    raw === 'LEVEDURAS' ||
    raw === 'INGREDIENTES' ||
    raw === 'SUPLEMENTOS'
  ) {
    return { code: 'MY-ST', label: 'Leveduras' }
  }

  if (raw && raw !== '—' && raw !== '-' && raw !== '?') {
    return { code: raw, label: raw }
  }

  return { code: 'OUTROS', label: 'Outros' }
}

export default function Resumo() {
  const currentDate = useMemo(() => new Date(), [])
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const currentQuarter = Math.ceil(currentMonth / 3)

  // Filtros de período
  const [periodType, setPeriodType] = useState<PeriodType>('mes')
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [selectedQuarter, setSelectedQuarter] = useState<number>(currentQuarter)
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`,
  )
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10),
  )

  // Painel Maestro
  const [maestroPanelOpen, setMaestroPanelOpen] = useState(false)

  // GlobalDataContext: lê todas as coleções centralizadas da loja global
  const {
    factories: globalFactories,
    orders: globalOrders,
    faturamento: faturamentos,
    faturamentoState,
    pedidos_carteira: pedidosCarteira,
    pedidosCarteiraState,
    pedidos: pedidosAbertos,
    pedidosState,
    syncAll: loadData,
  } = useGlobalData()

  const loading = faturamentoState.loading || pedidosCarteiraState.loading || pedidosState.loading
  const isRefreshing = false
  const error = Boolean(faturamentoState.error || pedidosCarteiraState.error || pedidosState.error)

  // Anos disponíveis para seleção (baseados nos dados ou default)
  const availableYears = useMemo(() => {
    const list: number[] = []
    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
      list.push(y)
    }
    return list
  }, [currentYear])

  // Mapa de clientes (factories) por nome e código para resolver segmento/carteira
  const factoryMap = useMemo(() => {
    const map = new Map<string, { carteira?: string; animalSpecies?: string | string[] }>()
    for (const f of globalFactories) {
      if (f.name) {
        map.set(f.name.trim().toLowerCase(), {
          carteira: f.carteira,
          animalSpecies: f.animalSpecies,
        })
      }
      const anyF = f as unknown as Record<string, unknown>
      if (typeof anyF.codigo_cliente === 'string' && anyF.codigo_cliente) {
        map.set(anyF.codigo_cliente.trim().toLowerCase(), {
          carteira: f.carteira,
          animalSpecies: f.animalSpecies,
        })
      }
    }
    return map
  }, [globalFactories])

  // Determinar intervalo de datas do período selecionado e do período anterior equivalente
  const { periodStart, periodEnd, prevStart, prevEnd, periodLabel } = useMemo(() => {
    let pStart = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0)
    let pEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999)
    let prStart = new Date(selectedYear, selectedMonth - 2, 1, 0, 0, 0, 0)
    let prEnd = new Date(selectedYear, selectedMonth - 1, 0, 23, 59, 59, 999)
    let label = `${MONTH_NAMES[selectedMonth]} de ${selectedYear}`

    if (periodType === 'trimestre') {
      const qStartMonth = (selectedQuarter - 1) * 3
      pStart = new Date(selectedYear, qStartMonth, 1, 0, 0, 0, 0)
      pEnd = new Date(selectedYear, qStartMonth + 3, 0, 23, 59, 59, 999)

      // Trimestre anterior
      let prevQ = selectedQuarter - 1
      let prevQYear = selectedYear
      if (prevQ < 1) {
        prevQ = 4
        prevQYear = selectedYear - 1
      }
      const prevQStartMonth = (prevQ - 1) * 3
      prStart = new Date(prevQYear, prevQStartMonth, 1, 0, 0, 0, 0)
      prEnd = new Date(prevQYear, prevQStartMonth + 3, 0, 23, 59, 59, 999)
      label = `${selectedQuarter}º Trimestre de ${selectedYear}`
    } else if (periodType === 'ano') {
      pStart = new Date(selectedYear, 0, 1, 0, 0, 0, 0)
      pEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999)
      prStart = new Date(selectedYear - 1, 0, 1, 0, 0, 0, 0)
      prEnd = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999)
      label = `Ano de ${selectedYear}`
    } else if (periodType === 'personalizado') {
      if (customStartDate) {
        const [sy, sm, sd] = customStartDate.split('-').map(Number)
        pStart = new Date(sy, sm - 1, sd || 1, 0, 0, 0, 0)
      }
      if (customEndDate) {
        const [ey, em, ed] = customEndDate.split('-').map(Number)
        pEnd = new Date(ey, em - 1, ed || 28, 23, 59, 59, 999)
      }
      const diffMs = Math.max(0, pEnd.getTime() - pStart.getTime())
      prEnd = new Date(pStart.getTime() - 1)
      prStart = new Date(prEnd.getTime() - diffMs)
      label = `Personalizado (${pStart.toLocaleDateString('pt-BR')} a ${pEnd.toLocaleDateString('pt-BR')})`
    }

    return {
      periodStart: pStart,
      periodEnd: pEnd,
      prevStart: prStart,
      prevEnd: prEnd,
      periodLabel: label,
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, customStartDate, customEndDate])

  // Filtragem de registros de faturamento no período e no período anterior
  const {
    currentPeriodFaturamentos,
    prevPeriodFaturamentos,
    faturamentoMesAtual,
    faturamentoAcumuladoAno,
  } = useMemo(() => {
    const curStartMs = periodStart.getTime()
    const curEndMs = periodEnd.getTime()
    const prevStartMs = prevStart.getTime()
    const prevEndMs = prevEnd.getTime()

    // Para o KPI Faturamento do Mês atual de referência:
    // Se o filtro estiver em 'mes', é o mês selecionado. Caso contrário, usa o mês atual corrente ou o mês do filtro
    const refYear = selectedYear
    const refMonth = periodType === 'mes' ? selectedMonth : currentMonth

    let sumMesAtual = 0
    let sumAcumAno = 0
    const curList: FaturamentoRecord[] = []
    const prevList: FaturamentoRecord[] = []

    for (const f of faturamentos) {
      const v = Number(f.valor_brl) || 0
      if (v <= 0) continue

      let docDate: Date | null = null
      if (f.data_documento) {
        const parts = f.data_documento.slice(0, 10).split('-')
        if (parts.length === 3) {
          docDate = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10),
          )
        }
      }
      if (!docDate && f.ano && f.mes) {
        docDate = new Date(f.ano, f.mes - 1, 1)
      }

      const fAno = f.ano || (docDate ? docDate.getFullYear() : 0)
      const fMes = f.mes || (docDate ? docDate.getMonth() + 1 : 0)

      // Faturamento Acumulado do Ano selecionado
      if (fAno === selectedYear) {
        sumAcumAno += v
      }

      // Faturamento do mês de referência
      if (fAno === refYear && fMes === refMonth) {
        sumMesAtual += v
      }

      if (docDate) {
        const t = docDate.getTime()
        if (t >= curStartMs && t <= curEndMs) {
          curList.push(f)
        } else if (t >= prevStartMs && t <= prevEndMs) {
          prevList.push(f)
        }
      }
    }

    return {
      currentPeriodFaturamentos: curList,
      prevPeriodFaturamentos: prevList,
      faturamentoMesAtual: sumMesAtual,
      faturamentoAcumuladoAno: sumAcumAno,
    }
  }, [
    faturamentos,
    periodStart,
    periodEnd,
    prevStart,
    prevEnd,
    selectedYear,
    selectedMonth,
    periodType,
    currentMonth,
  ])

  // KPIs
  const totalFaturadoPeriodo = useMemo(() => {
    return currentPeriodFaturamentos.reduce((acc, f) => acc + (Number(f.valor_brl) || 0), 0)
  }, [currentPeriodFaturamentos])

  const totalFaturadoPrev = useMemo(() => {
    return prevPeriodFaturamentos.reduce((acc, f) => acc + (Number(f.valor_brl) || 0), 0)
  }, [prevPeriodFaturamentos])

  // Pedidos no período (contagem de notas/pedidos)
  const qtdPedidosPeriodo = useMemo(() => {
    const docKeys = new Set<string>()
    for (const f of currentPeriodFaturamentos) {
      const key = f.nf_ano && f.cliente_codigo ? `${f.nf_ano}_${f.cliente_codigo}` : f.id
      docKeys.add(key)
    }
    return docKeys.size || currentPeriodFaturamentos.length
  }, [currentPeriodFaturamentos])

  const qtdPedidosPrev = useMemo(() => {
    const docKeys = new Set<string>()
    for (const f of prevPeriodFaturamentos) {
      const key = f.nf_ano && f.cliente_codigo ? `${f.nf_ano}_${f.cliente_codigo}` : f.id
      docKeys.add(key)
    }
    return docKeys.size || prevPeriodFaturamentos.length
  }, [prevPeriodFaturamentos])

  // Ticket Médio
  const ticketMedio = useMemo(() => {
    return qtdPedidosPeriodo > 0 ? totalFaturadoPeriodo / qtdPedidosPeriodo : 0
  }, [totalFaturadoPeriodo, qtdPedidosPeriodo])

  const ticketMedioPrev = useMemo(() => {
    return qtdPedidosPrev > 0 ? totalFaturadoPrev / qtdPedidosPrev : 0
  }, [totalFaturadoPrev, qtdPedidosPrev])

  // Clientes Ativos (com compras registradas no período)
  const clientesAtivosCount = useMemo(() => {
    const set = new Set<string>()
    for (const f of currentPeriodFaturamentos) {
      const name = (f.cliente_nome || f.cliente_codigo || '').trim()
      if (name) set.add(name)
    }
    return set.size
  }, [currentPeriodFaturamentos])

  const clientesAtivosPrevCount = useMemo(() => {
    const set = new Set<string>()
    for (const f of prevPeriodFaturamentos) {
      const name = (f.cliente_nome || f.cliente_codigo || '').trim()
      if (name) set.add(name)
    }
    return set.size
  }, [prevPeriodFaturamentos])

  // Pedidos em Carteira (Total Value)
  // Combina a coleção pedidos_carteira + pedidos abertos do gestaoPedidos + orders do globalDataContext
  const totalPedidosEmCarteira = useMemo(() => {
    let sum = 0

    // 1. Da coleção pedidos_carteira (totais por marca)
    const distinctMarcaTotal = new Map<string, number>()
    for (const pc of pedidosCarteira) {
      const marca = (pc.marca || '').trim()
      const total = Number(pc.total_geral) || Number(pc.valor) || 0
      if (marca && !distinctMarcaTotal.has(marca)) {
        distinctMarcaTotal.set(marca, total)
      } else if (!marca) {
        sum += Number(pc.valor) || 0
      }
    }
    for (const v of distinctMarcaTotal.values()) {
      sum += v
    }

    // 2. Pedidos em aberto (status ABERTO) de gestao_pedidos
    for (const p of pedidosAbertos) {
      if (p.status === 'ABERTO') {
        sum += Number(p.valorTotal) || 0
      }
    }

    // Se ainda zero, soma pedidos em orders que não tenham sido faturados
    if (sum === 0 && globalOrders.length > 0) {
      sum = globalOrders.reduce((acc, o) => acc + (Number(o.totalValue) || 0), 0)
    }

    return sum
  }, [pedidosCarteira, pedidosAbertos, globalOrders])

  // Variações percentuais (comparação versus período anterior)
  const calcVariation = (current: number, previous: number): number | null => {
    if (previous > 0) {
      return ((current - previous) / previous) * 100
    }
    if (current > 0 && previous === 0) return 100
    return null
  }

  const varFaturamentoMes = calcVariation(totalFaturadoPeriodo, totalFaturadoPrev)
  const varFaturamentoAno = calcVariation(
    faturamentoAcumuladoAno,
    // Acumulado do ano anterior
    faturamentos
      .filter((f) => (f.ano || 0) === selectedYear - 1)
      .reduce((acc, f) => acc + (Number(f.valor_brl) || 0), 0),
  )
  const varCarteira = null // backlog atual estático de comparação
  const varTicketMedio = calcVariation(ticketMedio, ticketMedioPrev)
  const varClientesAtivos = calcVariation(clientesAtivosCount, clientesAtivosPrevCount)

  // Top 5 Clientes: name, total faturado, participação percentual
  const top5Clientes = useMemo(() => {
    const clientMap = new Map<string, number>()
    for (const f of currentPeriodFaturamentos) {
      const name = (f.cliente_nome || f.cliente_codigo || 'Outros').trim()
      const val = Number(f.valor_brl) || 0
      clientMap.set(name, (clientMap.get(name) || 0) + val)
    }
    const list = Array.from(clientMap.entries()).map(([name, total]) => ({
      name,
      totalFaturado: total,
      participacao: totalFaturadoPeriodo > 0 ? (total / totalFaturadoPeriodo) * 100 : 0,
    }))
    list.sort((a, b) => b.totalFaturado - a.totalFaturado)
    return list.slice(0, 5)
  }, [currentPeriodFaturamentos, totalFaturadoPeriodo])

  // Top Famílias/Produtos: familia (código e rótulo canônico), total faturado, participação percentual
  const topFamilias = useMemo(() => {
    const famMap = new Map<string, { label: string; code: string; total: number }>()

    for (const f of currentPeriodFaturamentos) {
      const val = Number(f.valor_brl) || 0
      const { code, label } = resolveCanonicalFamilia(f.produto_codigo, f.familia_produto)
      const existing = famMap.get(code)
      if (existing) {
        existing.total += val
      } else {
        famMap.set(code, { code, label, total: val })
      }
    }

    const list = Array.from(famMap.values()).map((item) => ({
      ...item,
      participacao: totalFaturadoPeriodo > 0 ? (item.total / totalFaturadoPeriodo) * 100 : 0,
    }))
    list.sort((a, b) => b.total - a.total)
    return list
  }, [currentPeriodFaturamentos, totalFaturadoPeriodo])

  // Distribuição por segmento (Donut Chart de faturamento por segmento)
  const distribuicaoSegmento = useMemo(() => {
    const segMap = new Map<string, number>()

    for (const f of currentPeriodFaturamentos) {
      const val = Number(f.valor_brl) || 0
      const cName = (f.cliente_nome || '').trim().toLowerCase()
      const cCod = (f.cliente_codigo || '').trim().toLowerCase()

      const foundFactory = factoryMap.get(cName) || factoryMap.get(cCod)
      let seg = foundFactory?.carteira ? foundFactory.carteira.trim().toUpperCase() : ''

      if (!seg && foundFactory?.animalSpecies) {
        const rawSp = Array.isArray(foundFactory.animalSpecies)
          ? foundFactory.animalSpecies[0]
          : foundFactory.animalSpecies
        if (rawSp) seg = String(rawSp).trim().toUpperCase()
      }

      if (!seg) {
        // Fallback por linha/família de produto
        const { code } = resolveCanonicalFamilia(f.produto_codigo, f.familia_produto)
        if (code === 'MI-OR') seg = 'RUMINANTES'
        else if (code === 'MO-BE') seg = 'AVES'
        else if (code === 'MI-XS') seg = 'PETS'
        else if (code === 'MY-CO') seg = 'SUINOS'
        else seg = 'OUTROS'
      }

      segMap.set(seg, (segMap.get(seg) || 0) + val)
    }

    const list = Array.from(segMap.entries()).map(([segmento, valor]) => ({
      name: segmento,
      valor,
      participacao: totalFaturadoPeriodo > 0 ? (valor / totalFaturadoPeriodo) * 100 : 0,
    }))

    list.sort((a, b) => b.valor - a.valor)
    return list
  }, [currentPeriodFaturamentos, factoryMap, totalFaturadoPeriodo])

  // Cobertura: Gráfico comparando Carteira Futura (pedidos em aberto por mês de entrega)
  // versus Média Realizada Mensal, mês a mês para os próximos 6 meses.
  const coberturaData = useMemo(() => {
    // 1. Média realizada mensal (calculada com base no faturamento dos últimos 12 meses registrados)
    const monthTotals = new Map<string, number>()
    for (const f of faturamentos) {
      const v = Number(f.valor_brl) || 0
      if (v <= 0) continue
      const y = f.ano || (f.data_documento ? parseInt(f.data_documento.slice(0, 4), 10) : 0)
      const m = f.mes || (f.data_documento ? parseInt(f.data_documento.slice(5, 7), 10) : 0)
      if (y && m) {
        const k = `${y}-${String(m).padStart(2, '0')}`
        monthTotals.set(k, (monthTotals.get(k) || 0) + v)
      }
    }
    const nonZeroMonths = Array.from(monthTotals.values()).filter((v) => v > 0)
    const mediaMensalRealizada =
      nonZeroMonths.length > 0
        ? nonZeroMonths.reduce((a, b) => a + b, 0) / nonZeroMonths.length
        : totalFaturadoPeriodo > 0
          ? totalFaturadoPeriodo
          : 50000

    // 2. Montar próximos 6 meses
    const result: Array<{
      mesLabel: string
      ano: number
      mes: number
      carteiraFutura: number
      mediaRealizada: number
      coberturaPercent: number
    }> = []

    const startM = periodType === 'mes' ? selectedMonth : currentMonth
    const startY = selectedYear

    for (let i = 0; i < 6; i++) {
      let targetM = startM + i
      let targetY = startY
      while (targetM > 12) {
        targetM -= 12
        targetY += 1
      }

      const mesNomeExtenso = MONTH_NAMES[targetM]?.toLowerCase() || ''
      const mesAbrev = MONTH_SHORT[targetM] || `M${targetM}`
      const label = `${mesAbrev}/${String(targetY).slice(2)}`

      // Soma dos pedidos em aberto por mês de entrega
      let carteiraDoMes = 0

      // a) De pedidos_carteira (que armazena mês por extenso ou abreviado)
      for (const pc of pedidosCarteira) {
        const pcMes = String(pc.mes || '')
          .trim()
          .toLowerCase()
        const pcAno = (pc as unknown as Record<string, unknown>).ano as number | undefined
        if (
          pcMes === mesNomeExtenso ||
          (pcMes.startsWith(mesNomeExtenso.slice(0, 3)) && (!pcAno || pcAno === targetY))
        ) {
          carteiraDoMes += Number(pc.valor) || 0
        }
      }

      // b) De pedidos em aberto com dataEntregaPrevista no mês alvo
      for (const po of pedidosAbertos) {
        if (po.status === 'ABERTO' && po.dataEntregaPrevista) {
          const dParts = po.dataEntregaPrevista.slice(0, 7).split('-')
          if (dParts.length === 2) {
            const py = parseInt(dParts[0], 10)
            const pm = parseInt(dParts[1], 10)
            if (py === targetY && pm === targetM) {
              carteiraDoMes += Number(po.valorTotal) || 0
            }
          }
        }
      }

      const cobPerc = mediaMensalRealizada > 0 ? (carteiraDoMes / mediaMensalRealizada) * 100 : 0

      result.push({
        mesLabel: label,
        ano: targetY,
        mes: targetM,
        carteiraFutura: carteiraDoMes,
        mediaRealizada: Math.round(mediaMensalRealizada),
        coberturaPercent: Math.round(cobPerc * 10) / 10,
      })
    }

    return result
  }, [
    faturamentos,
    pedidosCarteira,
    pedidosAbertos,
    selectedMonth,
    selectedYear,
    periodType,
    currentMonth,
    totalFaturadoPeriodo,
  ])

  // Verificação de Estado EMPTY (sem faturamento, sem pedidos, sem clientes)
  const isEmpty =
    !loading &&
    !error &&
    faturamentos.length === 0 &&
    pedidosCarteira.length === 0 &&
    pedidosAbertos.length === 0

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-primary" /> Resumo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dashboard executivo de vendas, carteira de pedidos e cobertura comercial · {periodLabel}
          </p>
        </div>

        {/* Barra de Filtros e Ações */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Período (Mês, Trimestre, Ano, Personalizado) */}
          <div className="flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setPeriodType('mes')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                periodType === 'mes'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('trimestre')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                periodType === 'trimestre'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Trimestre
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('ano')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                periodType === 'ano'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Ano
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('personalizado')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                periodType === 'personalizado'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Personalizado
            </button>
          </div>

          {/* Sub-seletores dependendo do tipo de período */}
          {periodType === 'mes' && (
            <div className="flex items-center gap-1.5">
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => setSelectedMonth(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[125px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.slice(1).map((nome, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[88px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodType === 'trimestre' && (
            <div className="flex items-center gap-1.5">
              <Select
                value={String(selectedQuarter)}
                onValueChange={(val) => setSelectedQuarter(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Trimestre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="text-xs">
                    1º Trimestre (T1)
                  </SelectItem>
                  <SelectItem value="2" className="text-xs">
                    2º Trimestre (T2)
                  </SelectItem>
                  <SelectItem value="3" className="text-xs">
                    3º Trimestre (T3)
                  </SelectItem>
                  <SelectItem value="4" className="text-xs">
                    4º Trimestre (T4)
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[88px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodType === 'ano' && (
            <Select
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
            >
              <SelectTrigger className="h-8 w-[100px] text-xs bg-card/60 border-border/70">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((ano) => (
                  <SelectItem key={ano} value={String(ano)} className="text-xs">
                    {ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {periodType === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 w-[130px] text-xs bg-card/60 border-border/70 px-2"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 w-[130px] text-xs bg-card/60 border-border/70 px-2"
              />
            </div>
          )}

          {/* Botão MAESTRO */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setMaestroPanelOpen(true)}
            className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            title="Abrir assistente MAESTRO"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">MAESTRO</span>
          </Button>

          {/* Botão Atualizar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading || isRefreshing}
            className="h-8 gap-1.5 text-xs border-border/70 bg-card/60"
            title="Atualizar dados"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', (loading || isRefreshing) && 'animate-spin')} />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Banner de erro mantendo dados em background */}
      {error && !loading && (
        <SyncErrorBanner
          message="Não foi possível sincronizar o resumo."
          onRetry={() => void loadData()}
        />
      )}

      {/* 1. ESTADO DE LOADING (Skeletons no formato exato do dashboard) */}
      {loading && faturamentos.length === 0 && <DashboardSkeleton />}

      {/* 2. ESTADO DE ERRO TOTAL */}
      {error && !loading && faturamentos.length === 0 && (
        <Card className="glass-card border-destructive/30 shadow-card">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-semibold text-lg text-foreground">
                Não foi possível carregar o resumo
              </h3>
              <p className="text-sm text-muted-foreground">
                Ocorreu uma falha na consulta de faturamento, pedidos e clientes do servidor.
              </p>
            </div>
            <Button onClick={() => void loadData()} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 3. ESTADO EMPTY */}
      {isEmpty && (
        <Card className="glass-card border-dashed border-border/60 shadow-card">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-7 h-7" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-semibold text-xl text-foreground">Bem-vindo ao Resumo</h3>
              <p className="text-sm text-muted-foreground">
                Aqui você acompanha em tempo real o faturamento consolidado da Blink Biotech,
                pedidos em carteira, ticket médio e cobertura dos próximos meses. Para começar a
                visualizar seus indicadores, importe a planilha de faturamento ou notas fiscais.
              </p>
            </div>
            <Button asChild size="default" className="gap-2 shadow-sm font-semibold">
              <Link to="/importar-faturamento">
                <Upload className="w-4 h-4" /> Importar Faturamento
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. ESTADO SUCCESS (Content fades in) */}
      {!loading && !isEmpty && (
        <div className="space-y-8 animate-fade-in">
          {/* Grid de topo: TodayTasksWidget como primeiro card (full width mobile, half width desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TodayTasksWidget />
          </div>

          {/* WeeklyAgendaCard: abaixo do TodayTasksWidget, largura total */}
          <div className="w-full">
            <WeeklyAgendaCard />
          </div>

          {/* Seção 0: Alertas de Carteira (Topo do Resumo, antes de todas as seções) */}
          <AlertasCarteiraSection
            pedidosCarteira={pedidosCarteira}
            pedidosAbertos={pedidosAbertos}
            globalOrders={globalOrders}
            isLoading={loading}
            isError={Boolean(error && faturamentos.length === 0 && pedidosCarteira.length === 0)}
            onRetry={() => void loadData()}
          />

          {/* Seção 1: 5 KPI Cards no topo */}
          {/* Mobile: 1 coluna (< 768px). md: 2 ou 3 colunas. xl: 5 colunas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Card 1: Faturamento do Mês */}
            <KpiCard
              label="Faturamento do Mês"
              value={formatCurrency(faturamentoMesAtual)}
              icon={DollarSign}
              borderClass="border-l-primary"
              variation={varFaturamentoMes}
              subtext="vs mês anterior"
            />

            {/* Card 2: Faturamento Acumulado do Ano */}
            <KpiCard
              label={`Faturamento Acumulado (${selectedYear})`}
              value={formatCurrency(faturamentoAcumuladoAno)}
              icon={TrendingUp}
              borderClass="border-l-indigo-500"
              variation={varFaturamentoAno}
              subtext="vs ano anterior"
            />

            {/* Card 3: Pedidos em Carteira (Total Value) */}
            <KpiCard
              label="Pedidos em Carteira"
              value={formatCurrency(totalPedidosEmCarteira)}
              icon={Wallet}
              borderClass="border-l-amber-500"
              variation={varCarteira}
              subtext="Total em aberto / backlog"
            />

            {/* Card 4: Ticket Médio */}
            <KpiCard
              label="Ticket Médio"
              value={formatCurrency(ticketMedio)}
              icon={Receipt}
              borderClass="border-l-emerald-500"
              variation={varTicketMedio}
              subtext="vs período anterior"
            />

            {/* Card 5: Clientes Ativos */}
            <KpiCard
              label="Clientes Ativos"
              value={String(clientesAtivosCount)}
              icon={Users}
              borderClass="border-l-sky-500"
              variation={varClientesAtivos}
              subtext="Com compras no período"
            />
          </div>

          {/* Seção 2 & 3: Top 5 Clientes e Top Famílias */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 Clientes Table */}
            <Card className="glass-card shadow-card">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Top 5 Clientes
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Maiores faturamentos e participação na receita do período
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                    Top 5
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="w-12 text-center text-xs">#</TableHead>
                        <TableHead className="text-xs font-semibold">Cliente</TableHead>
                        <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                          Total Faturado
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                          Participação
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {top5Clientes.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center py-8 text-muted-foreground text-xs"
                          >
                            Nenhum cliente faturado no período selecionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        top5Clientes.map((c, idx) => (
                          <TableRow
                            key={`client-${idx}`}
                            className="border-border/20 hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium text-xs text-foreground">
                              {c.name}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                              {formatCurrency(c.totalFaturado)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className="font-mono text-[11px] font-semibold bg-muted/20"
                              >
                                {c.participacao.toFixed(1).replace('.', ',')}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile (< 768px): Responsive Cards */}
                <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
                  {top5Clientes.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Nenhum cliente faturado no período.
                    </div>
                  ) : (
                    top5Clientes.map((c, idx) => (
                      <div key={`mob-cli-${idx}`} className="pt-3 first:pt-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-xs text-foreground">{c.name}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] font-semibold bg-muted/20 shrink-0"
                          >
                            {c.participacao.toFixed(1).replace('.', ',')}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pl-7">
                          <span>Total Faturado:</span>
                          <span className="font-mono font-bold text-primary">
                            {formatCurrency(c.totalFaturado)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Famílias / Produtos Table */}
            <Card className="glass-card shadow-card">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" /> Top Famílias de Produtos
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Classificação por família (MI-XS, MO-BE, MY-CO, MI-OR, MY-ST)
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                    {topFamilias.length} família{topFamilias.length === 1 ? '' : 's'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="w-12 text-center text-xs">#</TableHead>
                        <TableHead className="text-xs font-semibold">Código</TableHead>
                        <TableHead className="text-xs font-semibold">Família</TableHead>
                        <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                          Total Faturado
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                          Participação
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topFamilias.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-8 text-muted-foreground text-xs"
                          >
                            Nenhuma família faturada no período selecionado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        topFamilias.map((f, idx) => (
                          <TableRow
                            key={`fam-${idx}`}
                            className="border-border/20 hover:bg-muted/30 transition-colors"
                          >
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold text-primary">
                              {f.code}
                            </TableCell>
                            <TableCell className="font-medium text-xs text-foreground">
                              {CODIGO_CANONICO_ROTULO[f.code] || f.label}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                              {formatCurrency(f.total)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className="font-mono text-[11px] font-semibold bg-muted/20"
                              >
                                {f.participacao.toFixed(1).replace('.', ',')}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile (< 768px): Responsive Cards */}
                <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
                  {topFamilias.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Nenhuma família faturada no período.
                    </div>
                  ) : (
                    topFamilias.map((f, idx) => (
                      <div key={`mob-fam-${idx}`} className="pt-3 first:pt-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-mono text-xs font-bold text-primary mr-1.5">
                                {f.code}
                              </span>
                              <span className="font-semibold text-xs text-foreground">
                                {CODIGO_CANONICO_ROTULO[f.code] || f.label}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] font-semibold bg-muted/20 shrink-0"
                          >
                            {f.participacao.toFixed(1).replace('.', ',')}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground pl-7">
                          <span>Total Faturado:</span>
                          <span className="font-mono font-bold text-foreground">
                            {formatCurrency(f.total)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seção 4 & 5: Cobertura (Próximos 6 Meses) e Distribuição por Segmento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico 4: Cobertura (Carteira Futura vs Média Realizada Mensal - Próximos 6 meses) */}
            <Card className="glass-card shadow-card">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Cobertura: Carteira Futura vs
                      Média Realizada
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Pedidos em aberto mês a mês pelos próximos 6 meses vs média realizada mensal
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="w-full h-[290px] overflow-x-auto">
                  <div className="min-w-[420px] h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={coberturaData}
                        margin={{ top: 15, right: 15, left: -5, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="mesLabel"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickFormatter={(v) =>
                            v >= 1e6
                              ? `${(v / 1e6).toFixed(1)}M`
                              : v >= 1e3
                                ? `${(v / 1e3).toFixed(0)}k`
                                : String(v)
                          }
                        />
                        <RechartsTooltip content={<CustomChartTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                          formatter={(value) =>
                            value === 'carteiraFutura'
                              ? 'Carteira Futura (Em Aberto)'
                              : 'Média Realizada Mensal'
                          }
                        />
                        <Bar
                          dataKey="carteiraFutura"
                          name="carteiraFutura"
                          fill="#0284c7"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        />
                        <Bar
                          dataKey="mediaRealizada"
                          name="mediaRealizada"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico 5: Distribuição por Segmento */}
            <Card className="glass-card shadow-card">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-primary" /> Distribuição por Segmento
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Faturamento por segmento (AVES, PETS, RUMINANTES, SUÍNOS, AQUA)
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                    {distribuicaoSegmento.length} segmento
                    {distribuicaoSegmento.length === 1 ? '' : 's'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {distribuicaoSegmento.length === 0 ? (
                  <div className="h-[290px] flex items-center justify-center text-xs text-muted-foreground">
                    Nenhum dado de segmento registrado para o período.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 h-[290px]">
                    <div className="w-full h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={distribuicaoSegmento}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="valor"
                            nameKey="name"
                          >
                            {distribuicaoSegmento.map((_, idx) => (
                              <Cell
                                key={`seg-cell-${idx}`}
                                fill={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(val: number | string | undefined) => [
                              formatCurrency(Number(val) || 0),
                              'Faturamento',
                            ]}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Lista e Legenda de Segmentos com Participação */}
                    <div className="space-y-2 overflow-y-auto max-h-[240px] pr-2">
                      {distribuicaoSegmento.map((item, idx) => (
                        <div
                          key={`seg-item-${idx}`}
                          className="flex items-center justify-between text-xs p-1.5 rounded-md hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
                              }}
                            />
                            <span className="font-semibold text-foreground truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-muted-foreground">
                              {formatCurrency(item.valor)}
                            </span>
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] font-bold bg-muted/20"
                            >
                              {item.participacao.toFixed(1).replace('.', ',')}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Seção Aditiva: Metas por Vendedor e Segmento (no rodapé da página após todas as seções existentes) */}
      <MetasVendedorSegmentoSection
        faturamentos={faturamentos}
        factoryMap={factoryMap}
        factories={globalFactories}
      />

      {/* Painel de Chat MAESTRO */}
      <MaestroChatPanel
        open={maestroPanelOpen}
        onOpenChange={setMaestroPanelOpen}
        initialPeriodInfo={{
          mode: 'month',
          ano: selectedYear,
          mes: selectedMonth,
        }}
      />
    </div>
  )
}

/** Componente de KPI Card com ícone, label, valor e comparação vs período anterior */
interface KpiCardProps {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  borderClass: string
  variation: number | null
  subtext: string
}

function KpiCard({ label, value, icon: Icon, borderClass, variation, subtext }: KpiCardProps) {
  return (
    <Card
      className={cn('glass-card hover-lift border-l-4 transition-all shadow-subtle', borderClass)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0 ml-2">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {value}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {variation !== null && !isNaN(variation) ? (
              <>
                {variation > 0 ? (
                  <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />+
                    {variation.toFixed(1).replace('.', ',')}%
                  </span>
                ) : variation < 0 ? (
                  <span className="inline-flex items-center font-bold text-destructive">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {variation.toFixed(1).replace('.', ',')}%
                  </span>
                ) : (
                  <span className="inline-flex items-center font-semibold text-muted-foreground">
                    <Minus className="w-3.5 h-3.5 mr-0.5" />
                    0,0%
                  </span>
                )}
                <span className="text-muted-foreground truncate">{subtext}</span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">{subtext}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Custom Tooltip para o gráfico de Cobertura */
function CustomChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { coberturaPercent: number } }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const carteira = payload.find((p) => p.name === 'carteiraFutura')?.value ?? 0
  const media = payload.find((p) => p.name === 'mediaRealizada')?.value ?? 0
  const cobertura = payload[0]?.payload?.coberturaPercent ?? 0

  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border p-3 rounded-lg shadow-lg text-xs space-y-1.5 min-w-[200px]">
      <p className="font-bold text-foreground border-b border-border/50 pb-1">{label}</p>
      <div className="flex justify-between items-center text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0284c7]" /> Carteira Futura:
        </span>
        <span className="font-mono font-semibold text-foreground">{formatCurrency(carteira)}</span>
      </div>
      <div className="flex justify-between items-center text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" /> Média Mensal:
        </span>
        <span className="font-mono font-semibold text-foreground">{formatCurrency(media)}</span>
      </div>
      <div className="flex justify-between items-center pt-1 border-t border-border/50">
        <span className="font-semibold text-foreground">Cobertura:</span>
        <span
          className={cn(
            'font-mono font-bold',
            cobertura >= 80
              ? 'text-emerald-500'
              : cobertura >= 50
                ? 'text-amber-500'
                : 'text-destructive',
          )}
        >
          {cobertura.toFixed(1).replace('.', ',')}%
        </span>
      </div>
    </div>
  )
}

/** Skeleton que mimetiza fielmente o formato do dashboard */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-shimmer">
      {/* TodayTasksWidget Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card shadow-card p-[20px]">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="py-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <div className="pt-3 border-t border-border/30">
            <Skeleton className="h-[6px] w-full rounded-full" />
          </div>
        </Card>
      </div>

      {/* WeeklyAgendaCard Skeleton */}
      <div className="w-full">
        <Card className="glass-card shadow-card p-[20px] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </Card>
      </div>

      {/* 5 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={`kpi-skel-${i}`} className="glass-card shadow-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3.5 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2 Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={`tab-skel-${i}`} className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56 mt-1" />
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2 Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={`chart-skel-${i}`} className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64 mt-1" />
            </CardHeader>
            <CardContent className="p-4 flex items-center justify-center h-[290px]">
              <Skeleton className="h-full w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
