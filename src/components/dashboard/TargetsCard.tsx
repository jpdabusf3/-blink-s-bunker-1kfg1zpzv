import { useState, useEffect, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { useAppContext } from '@/store/AppContext'

export function TargetsCard({ regionFilter }: { regionFilter: string }) {
  const [targets, setTargets] = useState<Target[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const { factories } = useAppContext()

  const loadData = async () => {
    try {
      const [t, o] = await Promise.all([
        pb.collection('targets').getFullList<Target>(),
        pb.collection('orders').getFullList<Order>(),
      ])
      setTargets(t)
      setOrders(o)
    } catch {
      /* intentionally ignored */
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('targets', () => {
    loadData()
  })
  useRealtime('orders', () => {
    loadData()
  })

  const targetProgress = useMemo(() => {
    return targets.map((target) => {
      let matchingOrders = orders.filter((o) => {
        const orderDate = new Date(o.orderDate)
        const start = new Date(target.startDate)
        const end = new Date(target.endDate)

        if (orderDate < start || orderDate > end) return false

        const factory = factories.find((f) => f.id === o.factoryId)
        if (!factory) return false

        if (regionFilter !== 'Todas as Regiões' && factory.region !== regionFilter) return false

        if (target.categoryType === 'Region' && target.categoryValue) {
          if (factory.region !== target.categoryValue) return false
        } else if (target.categoryType === 'Channel' && target.categoryValue) {
          const channel =
            factory.salesChannel === 'Indirect' ? factory.indirectChannelType : factory.salesChannel
          if (channel !== target.categoryValue) return false
        } else if (target.categoryType === 'ProductLine' && target.categoryValue) {
          if (o.line !== target.categoryValue) return false
        }

        return true
      })

      const totalSales = matchingOrders.reduce((sum, o) => sum + o.totalValue, 0)
      const percentage = target.targetValue > 0 ? (totalSales / target.targetValue) * 100 : 0

      return {
        ...target,
        totalSales,
        percentage,
      }
    })
  }, [targets, orders, factories, regionFilter])

  if (targets.length === 0) return null

  return (
    <Card className="shadow-subtle col-span-full print:bg-muted/10 print:border-none print:shadow-none">
      <CardHeader>
        <CardTitle>Acompanhamento de Metas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {targetProgress.map((t) => {
          const clamped = Math.min(t.percentage, 100)
          let colorClass = 'bg-green-500'
          if (t.percentage < 50) colorClass = 'bg-destructive'
          else if (t.percentage <= 80) colorClass = 'bg-yellow-500'

          let categoryLabel = 'Geral'
          if (t.categoryType === 'Region') categoryLabel = `Região: ${t.categoryValue}`
          if (t.categoryType === 'Channel') categoryLabel = `Canal: ${t.categoryValue}`
          if (t.categoryType === 'ProductLine') categoryLabel = `Linha: ${t.categoryValue}`

          return (
            <div key={t.id} className="space-y-2">
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="font-semibold text-sm">{t.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel} ({new Date(t.startDate).toLocaleDateString('pt-BR')} -{' '}
                    {new Date(t.endDate).toLocaleDateString('pt-BR')})
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold">{formatCurrency(t.totalSales)}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    / {formatCurrency(t.targetValue)} ({t.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-in-out ${colorClass}`}
                  style={{ width: `${clamped}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
