import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAppContext } from '@/store/AppContext'
import { getOrders } from '@/services/orders'
import { getTargets } from '@/services/targets'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { formatCompactCurrency } from '@/lib/utils'
import type { Order, Target } from '@/types'
import { computeComparisons, computeYoYDelta, getMonthName } from '@/lib/historical-comparison'

export function HistoricalComparisonCard({
  regionFilter = 'Todas as Regiões',
}: {
  regionFilter?: string
}) {
  const { factories } = useAppContext()
  const [orders, setOrders] = useState<Order[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [catType, setCatType] = useState('General')
  const [catVal, setCatVal] = useState('')

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

  const comparisons = useMemo(
    () =>
      computeComparisons(
        orders,
        targets,
        factories,
        selectedMonth,
        selectedYear,
        catType,
        catVal,
        regionFilter,
      ),
    [orders, targets, factories, selectedMonth, selectedYear, catType, catVal, regionFilter],
  )

  const hasData = comparisons.some((c) => c.actual > 0 || c.target > 0)

  const chartData = comparisons.map((c) => ({
    year: String(c.year),
    Meta: Math.round(c.target),
    Realizado: Math.round(c.actual),
  }))

  const availableRegions = [
    ...new Set(
      factories.flatMap((f) => (Array.isArray(f.region) ? f.region : [f.region])).filter(Boolean),
    ),
  ]
  const availableLines = [...new Set(orders.map((o) => o.line).filter(Boolean))]
  const availableChannels = [
    ...new Set(
      factories
        .map((f) => (f.salesChannel === 'Indirect' ? f.indirectChannelType : f.salesChannel))
        .filter(Boolean),
    ),
  ]

  const catValues =
    catType === 'Region'
      ? availableRegions
      : catType === 'ProductLine'
        ? availableLines
        : catType === 'Channel'
          ? availableChannels
          : []

  return (
    <Card className="shadow-subtle print:break-inside-avoid">
      <CardHeader>
        <CardTitle>Comparativo Histórico de Metas</CardTitle>
        <CardDescription>
          Compare o desempenho do mês selecionado com anos anteriores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {getMonthName(i + 1, true)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={catType}
            onValueChange={(v) => {
              setCatType(v)
              setCatVal('')
            }}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="General">Geral</SelectItem>
              <SelectItem value="Region">Região</SelectItem>
              <SelectItem value="ProductLine">Linha Produto</SelectItem>
              <SelectItem value="Channel">Canal</SelectItem>
            </SelectContent>
          </Select>
          {catType !== 'General' && (
            <Select value={catVal} onValueChange={setCatVal}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {catValues.map((v) => {
                  const valStr = String(v)
                  return (
                    <SelectItem key={valStr} value={valStr}>
                      {valStr}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        {hasData ? (
          <>
            <div className="h-[260px]">
              <ChartContainer
                config={{
                  Meta: { label: 'Meta (R$)', color: 'hsl(var(--muted-foreground))' },
                  Realizado: { label: 'Realizado (R$)', color: 'hsl(var(--primary))' },
                }}
                className="h-full w-full"
              >
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="year"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="Meta"
                    fill="hsl(var(--muted-foreground))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                    fillOpacity={0.4}
                  />
                  <Bar
                    dataKey="Realizado"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ChartContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              {comparisons.slice(0, -1).map((c, i) => {
                const prev = comparisons[i + 1]
                const delta = computeYoYDelta(c.actual, prev.actual)
                return (
                  <div key={c.year} className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">
                      {c.year} vs {prev.year}:
                    </span>
                    {delta === null ? (
                      <span className="text-muted-foreground flex items-center gap-0.5">
                        <Minus className="w-3 h-3" /> Sem dados
                      </span>
                    ) : (
                      <span
                        className={`flex items-center gap-0.5 font-semibold ${delta >= 0 ? 'text-green-500' : 'text-destructive'}`}
                      >
                        {delta >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {delta >= 0 ? '+' : ''}
                        {delta.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="h-[260px] flex flex-col items-center justify-center text-center gap-2">
            <p className="text-muted-foreground text-sm">
              Sem dados históricos disponíveis para este período
            </p>
            <p className="text-xs text-muted-foreground">Tente selecionar outro mês ou ano</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
