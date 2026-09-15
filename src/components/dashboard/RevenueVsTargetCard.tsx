import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { getOrders } from '@/services/orders'
import { getTargets } from '@/services/targets'
import { Order, Target } from '@/types'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { formatCompactCurrency } from '@/lib/utils'

export function RevenueVsTargetCard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [targets, setTargets] = useState<Target[]>([])

  const loadData = async () => {
    try {
      const [o, t] = await Promise.all([getOrders(), getTargets()])
      setOrders(o)
      setTargets(t)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtimeData('orders', loadData)
  useRealtimeData('targets', loadData)

  const { totalRevenue, totalTarget, percentage } = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.totalValue, 0)
    const generalTargets = targets.filter((t) => t.categoryType === 'General')
    const targetSum = generalTargets.reduce((s, t) => s + t.targetValue, 0)
    const pct = targetSum > 0 ? (revenue / targetSum) * 100 : 0
    return { totalRevenue: revenue, totalTarget: targetSum, percentage: pct }
  }, [orders, targets])

  const clampedPct = Math.min(percentage, 100)
  const colorClass =
    percentage >= 100 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-destructive'

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Receita Total vs Meta da Empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="text-2xl font-bold text-primary">{formatCompactCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Meta Total</p>
            <p className="text-2xl font-bold">{formatCompactCurrency(totalTarget)}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-semibold">{percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-in-out ${colorClass}`}
              style={{ width: `${clampedPct}%` }}
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-center pt-2">
          {percentage >= 100
            ? '✅ Meta atingida!'
            : percentage >= 50
              ? '⚠️ Em progresso'
              : '🚨 Abaixo do esperado'}
        </div>
      </CardContent>
    </Card>
  )
}
