import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { useAppContext } from '@/store/AppContext'
import { getOrders } from '@/services/orders'
import { getTargets } from '@/services/targets'
import { Order, Target } from '@/types'
import { useRealtimeData } from '@/hooks/useRealtimeData'

const REGIONS = ['Norte', 'Sul', 'Leste', 'Oeste', 'Médio-Norte']

export function GlobalRankingCard() {
  const { factories } = useAppContext()
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

  const chartData = useMemo(() => {
    return REGIONS.map((region) => {
      const regionFactoryIds = new Set(
        factories.filter((f) => f.region === region || f.stateRegion === region).map((f) => f.id),
      )
      const regionOrders = orders.filter(
        (o) => regionFactoryIds.has(o.factoryId) || (o as any).region === region,
      )
      const sales = regionOrders.reduce((s, o) => s + o.totalValue, 0)
      const regionTargets = targets.filter(
        (t) => t.categoryType === 'Region' && t.categoryValue === region,
      )
      const targetValue = regionTargets.reduce((s, t) => s + t.targetValue, 0)
      return { name: region, Vendas: sales, Meta: targetValue }
    }).filter((d) => d.Vendas > 0 || d.Meta > 0)
  }, [factories, orders, targets])

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Comparativo Macro por Região</CardTitle>
        <CardDescription>Vendas vs Meta por região</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ChartContainer
          config={{
            Vendas: { label: 'Vendas (R$)', color: 'hsl(var(--primary))' },
            Meta: { label: 'Meta (R$)', color: 'hsl(var(--muted-foreground))' },
          }}
          className="h-full w-full"
        >
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="Meta"
              fill="hsl(var(--muted-foreground))"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="Vendas"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
