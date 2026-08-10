import { getMetas } from '@/services/metas'
import { getHistoricoVendas } from '@/services/historico-vendas'
import { getGestoresTecnicos } from '@/services/gestao-tecnica'
import { getAllFactories } from '@/services/factories'
import type { Factory } from '@/types'

export interface ConsolidatedKPIs {
  totalFunnelValue: number
  inativoCount: number
  mensalCount: number
  ativoCount: number
  totalTarget: number
  totalAchieved: number
  achievementPct: number
  totalSales: number
}

export interface PeriodComparison {
  label: string
  sales: number
  target: number
  achieved: number
}

export type MonthComparison = PeriodComparison
export type QuarterlyComparison = PeriodComparison

export interface VendorRanking {
  id: string
  nome: string
  totalSales: number
  metaValor: number
  valorRealizado: number
  achievementPct: number
}

export interface GestorRanking {
  id: string
  nome: string
  metaValor: number
  valorRealizado: number
  achievementPct: number
  totalSales: number
  curMonthSales: number
  prevMonthSales: number
}

export interface ConsolidatedData {
  kpis: ConsolidatedKPIs
  monthComparisons: MonthComparison[]
  quarterlyComparisons: QuarterlyComparison[]
  vendorRanking: VendorRanking[]
  gestorRanking: GestorRanking[]
}

const MONTH_LABELS = [
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
const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

function monthLabel(d: Date) {
  return MONTH_LABELS[d.getMonth()]
}

function isSameMonth(d: Date, ref: Date) {
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()
}

function parsePeriodoToQuarter(periodo: string): { year: number; quarter: number } | null {
  if (!periodo) return null
  const p = periodo.toLowerCase().trim()
  const ym = p.match(/(\d{4})/)
  if (!ym) return null
  const year = parseInt(ym[1])
  const qMatch = p.match(/q([1-4])/) || p.match(/([1-4])\s*(?:t|trimestre)/)
  if (qMatch) return { year, quarter: parseInt(qMatch[1]) }
  let month = -1
  const m1 = p.match(/(\d{4})-(\d{1,2})/)
  if (m1) month = parseInt(m1[2])
  if (month === -1) {
    const m2 = p.match(/(\d{1,2})\/(\d{4})/)
    if (m2) month = parseInt(m2[1])
  }
  if (month === -1) {
    const names = [
      'janeiro',
      'fevereiro',
      'março',
      'marco',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ]
    const abbr = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ]
    for (let i = 0; i < 12; i++) {
      if (p.includes(names[i]) || p.includes(abbr[i])) {
        month = i + 1
        break
      }
    }
  }
  if (month < 1 || month > 12) return null
  return { year, quarter: Math.ceil(month / 3) }
}

function getQuarterFromDate(dateStr: string): { year: number; quarter: number } | null {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return { year: d.getFullYear(), quarter: Math.floor(d.getMonth() / 3) + 1 }
}

export async function fetchConsolidatedData(): Promise<ConsolidatedData> {
  const [metas, vendas, gestores, factories] = await Promise.all([
    getMetas(),
    getHistoricoVendas(),
    getGestoresTecnicos(),
    getAllFactories(),
  ])

  const funnelFactories = factories.filter((f) => f.status_funil)
  const totalFunnelValue = funnelFactories.reduce((s, f) => s + (f.valor_medio || 0), 0)
  const totalTarget = metas.reduce((s, m) => s + (m.meta_valor || 0), 0)
  const totalAchieved = metas.reduce((s, m) => s + (m.valor_realizado || 0), 0)
  const totalSales = vendas.reduce((s, v) => s + (v.valor || 0), 0)

  const kpis: ConsolidatedKPIs = {
    totalFunnelValue,
    inativoCount: funnelFactories.filter((f) => f.status_funil === 'Inativo').length,
    mensalCount: funnelFactories.filter((f) => f.status_funil === 'Mensal').length,
    ativoCount: funnelFactories.filter((f) => f.status_funil === 'Ativo').length,
    totalTarget,
    totalAchieved,
    achievementPct: totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0,
    totalSales,
  }

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const curSales = vendas
    .filter((v) => isSameMonth(new Date(v.data), now))
    .reduce((s, v) => s + (v.valor || 0), 0)
  const prevSales = vendas
    .filter((v) => isSameMonth(new Date(v.data), prev))
    .reduce((s, v) => s + (v.valor || 0), 0)

  const monthComparisons: MonthComparison[] = [
    {
      label: monthLabel(prev),
      sales: prevSales,
      target: totalTarget / 2,
      achieved: totalAchieved / 2,
    },
    {
      label: monthLabel(now),
      sales: curSales,
      target: totalTarget / 2,
      achieved: totalAchieved / 2,
    },
  ]

  const curQ = Math.floor(now.getMonth() / 3) + 1
  const curY = now.getFullYear()
  const prevQ = curQ === 1 ? 4 : curQ - 1
  const prevY = curQ === 1 ? curY - 1 : curY

  const curQS = vendas
    .filter((v) => {
      const q = getQuarterFromDate(v.data)
      return q && q.year === curY && q.quarter === curQ
    })
    .reduce((s, v) => s + (v.valor || 0), 0)
  const prevQS = vendas
    .filter((v) => {
      const q = getQuarterFromDate(v.data)
      return q && q.year === prevY && q.quarter === prevQ
    })
    .reduce((s, v) => s + (v.valor || 0), 0)
  const curQM = metas.filter((m) => {
    const q = parsePeriodoToQuarter(m.periodo || '')
    return q && q.year === curY && q.quarter === curQ
  })
  const prevQM = metas.filter((m) => {
    const q = parsePeriodoToQuarter(m.periodo || '')
    return q && q.year === prevY && q.quarter === prevQ
  })
  const curQT = curQM.reduce((s, m) => s + (m.meta_valor || 0), 0)
  const curQA = curQM.reduce((s, m) => s + (m.valor_realizado || 0), 0)
  const prevQT = prevQM.reduce((s, m) => s + (m.meta_valor || 0), 0)
  const prevQA = prevQM.reduce((s, m) => s + (m.valor_realizado || 0), 0)

  const quarterlyComparisons: QuarterlyComparison[] = [
    {
      label: `${QUARTER_LABELS[prevQ - 1]} ${prevY}`,
      sales: prevQS,
      target: prevQT,
      achieved: prevQA,
    },
    { label: `${QUARTER_LABELS[curQ - 1]} ${curY}`, sales: curQS, target: curQT, achieved: curQA },
  ]

  const vMap = new Map<string, VendorRanking>()
  vendas.forEach((v) => {
    const vid = v.vendedor_id || ''
    if (!vid) return
    const ex = vMap.get(vid) || {
      id: vid,
      nome: v.expand?.vendedor_id?.nome || 'N/A',
      totalSales: 0,
      metaValor: 0,
      valorRealizado: 0,
      achievementPct: 0,
    }
    ex.totalSales += v.valor || 0
    vMap.set(vid, ex)
  })
  metas.forEach((m) => {
    const vid = m.vendedor_id || ''
    if (!vid) return
    const ex = vMap.get(vid) || {
      id: vid,
      nome: m.expand?.vendedor_id?.nome || 'N/A',
      totalSales: 0,
      metaValor: 0,
      valorRealizado: 0,
      achievementPct: 0,
    }
    ex.metaValor += m.meta_valor || 0
    ex.valorRealizado += m.valor_realizado || 0
    if (ex.nome === 'N/A' && m.expand?.vendedor_id?.nome) ex.nome = m.expand.vendedor_id.nome
    vMap.set(vid, ex)
  })
  const vendorRanking = Array.from(vMap.values())
    .map((v) => ({
      ...v,
      achievementPct: v.metaValor > 0 ? (v.valorRealizado / v.metaValor) * 100 : 0,
    }))
    .sort((a, b) => b.achievementPct - a.achievementPct)
    .slice(0, 10)

  const gMap = new Map<string, GestorRanking>()
  gestores.forEach((g) =>
    gMap.set(g.id, {
      id: g.id,
      nome: g.nome,
      metaValor: 0,
      valorRealizado: 0,
      achievementPct: 0,
      totalSales: 0,
      curMonthSales: 0,
      prevMonthSales: 0,
    }),
  )
  metas.forEach((m) => {
    const gid = m.gestor_tecnico_id || ''
    if (!gid || !gMap.has(gid)) return
    const g = gMap.get(gid)!
    g.metaValor += m.meta_valor || 0
    g.valorRealizado += m.valor_realizado || 0
  })
  vendas.forEach((v) => {
    const gid = v.gestor_tecnico_id || ''
    if (!gid || !gMap.has(gid)) return
    const g = gMap.get(gid)!
    g.totalSales += v.valor || 0
    const vd = new Date(v.data)
    if (isSameMonth(vd, now)) g.curMonthSales += v.valor || 0
    if (isSameMonth(vd, prev)) g.prevMonthSales += v.valor || 0
  })
  const gestorRanking = Array.from(gMap.values())
    .map((g) => ({
      ...g,
      achievementPct: g.metaValor > 0 ? (g.valorRealizado / g.metaValor) * 100 : 0,
    }))
    .sort((a, b) => b.achievementPct - a.achievementPct)

  return { kpis, monthComparisons, quarterlyComparisons, vendorRanking, gestorRanking }
}

export async function fetchGestorComparison(): Promise<GestorRanking[]> {
  return (await fetchConsolidatedData()).gestorRanking
}
