import type { Order, Target, Factory } from '@/types'

export interface YearComparison {
  year: number
  actual: number
  target: number
}

export interface MonthMilestone {
  year: number
  month: number
  actual: number
  target: number
  label: string
  isExceeded: boolean
  isPeak: boolean
}

const MONTH_SHORT = [
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
const MONTH_FULL = [
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

export const getMonthName = (m: number, full = false): string =>
  (full ? MONTH_FULL : MONTH_SHORT)[m - 1] || ''

export const computeYoYDelta = (cur: number, prev: number): number | null =>
  prev === 0 ? null : ((cur - prev) / prev) * 100

export function prorateTarget(t: Target, year: number, month: number): number {
  const ms = new Date(year, month - 1, 1)
  const me = new Date(year, month, 0, 23, 59, 59, 999)
  const ts = new Date(t.startDate)
  const te = new Date(t.endDate)
  const os = new Date(Math.max(ms.getTime(), ts.getTime()))
  const oe = new Date(Math.min(me.getTime(), te.getTime()))
  if (oe < os) return 0
  const om = oe.getTime() - os.getTime() + 86400000
  const tm = te.getTime() - ts.getTime() + 86400000
  return tm > 0 ? (t.targetValue * om) / tm : 0
}

function ordersInMonth(
  orders: Order[],
  factories: Factory[],
  region: string,
  year: number,
  month: number,
): Order[] {
  return orders.filter((o) => {
    const d = new Date(o.orderDate)
    if (d.getFullYear() !== year || d.getMonth() !== month - 1) return false
    if (region !== 'Todas as Regiões') {
      const f = factories.find((x) => x.id === o.factoryId)
      if (!f || (f.region !== region && f.stateRegion !== region)) return false
    }
    return true
  })
}

function applyCategoryFilter(
  orders: Order[],
  factories: Factory[],
  catType: string,
  catVal: string,
): Order[] {
  if (!catVal) return orders
  return orders.filter((o) => {
    const f = factories.find((x) => x.id === o.factoryId)
    if (catType === 'Region') return f?.region === catVal
    if (catType === 'ProductLine') return o.line === catVal
    if (catType === 'Channel') {
      const ch = f?.salesChannel === 'Indirect' ? f?.indirectChannelType : f?.salesChannel
      return ch === catVal
    }
    return true
  })
}

function filterTargets(
  targets: Target[],
  catType: string,
  catVal: string,
  year: number,
  month: number,
): Target[] {
  const ms = new Date(year, month - 1, 1)
  const me = new Date(year, month, 0, 23, 59, 59, 999)
  return targets.filter((t) => {
    const ts = new Date(t.startDate)
    const te = new Date(t.endDate)
    if (ts > me || te < ms) return false
    if (!catVal || t.categoryType === 'General') return true
    return t.categoryType === catType && t.categoryValue === catVal
  })
}

export function computeComparisons(
  orders: Order[],
  targets: Target[],
  factories: Factory[],
  month: number,
  year: number,
  catType: string,
  catVal: string,
  region: string,
  yearsBack = 2,
): YearComparison[] {
  const results: YearComparison[] = []
  for (let i = 0; i <= yearsBack; i++) {
    const y = year - i
    let scoped = ordersInMonth(orders, factories, region, y, month)
    scoped = applyCategoryFilter(scoped, factories, catType, catVal)
    const actual = scoped.reduce((s, o) => s + o.totalValue, 0)
    const t = filterTargets(targets, catType, catVal, y, month)
    const target = t.reduce((s, x) => s + prorateTarget(x, y, month), 0)
    results.push({ year: y, actual, target })
  }
  return results
}

export function computeMilestones(
  orders: Order[],
  targets: Target[],
  factories: Factory[],
  region: string,
  monthsBack = 12,
): MonthMilestone[] {
  const now = new Date()
  const results: MonthMilestone[] = []
  let peak = 0
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const scoped = ordersInMonth(orders, factories, region, y, m)
    const actual = scoped.reduce((s, o) => s + o.totalValue, 0)
    const t = filterTargets(targets, '', '', y, m)
    const target = t.reduce((s, x) => s + prorateTarget(x, y, m), 0)
    if (actual > peak) peak = actual
    results.push({
      year: y,
      month: m,
      actual,
      target,
      label: `${getMonthName(m)} ${y}`,
      isExceeded: target > 0 && actual >= target,
      isPeak: false,
    })
  }
  results.forEach((r) => {
    r.isPeak = r.actual === peak && r.actual > 0
  })
  return results.reverse()
}
