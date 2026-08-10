import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { useRealtime } from '@/hooks/use-realtime'
import { fetchConsolidatedData, type ConsolidatedData } from '@/services/consolidated-dashboard'
import { formatCompactCurrency, formatCurrency } from '@/lib/utils'
import { Loader2, TrendingUp, TrendingDown, Trophy, Target, DollarSign, Layers } from 'lucide-react'

export function ConsolidatedDashboard() {
  const [data, setData] = useState<ConsolidatedData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setData(await fetchConsolidatedData())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('metas', loadData)
  useRealtime('historico_vendas', loadData)
  useRealtime('factories', loadData)

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  if (!data) return null

  const { kpis, monthComparisons, vendorRanking } = data
  const salesDelta = monthComparisons[1].sales - monthComparisons[0].sales
  const salesDeltaPct =
    monthComparisons[0].sales > 0 ? (salesDelta / monthComparisons[0].sales) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-subtle p-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Valor Total Funil
            </h3>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-primary">
            {formatCompactCurrency(kpis.totalFunnelValue)}
          </div>
        </Card>
        <Card className="shadow-subtle p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-accent-foreground" />
            <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Distribuição Funil
            </h3>
          </div>
          <div className="text-lg sm:text-2xl font-bold">
            <span className="text-red-500">{kpis.inativoCount}</span>
            <span className="text-muted-foreground text-sm"> / </span>
            <span className="text-yellow-500">{kpis.mensalCount}</span>
            <span className="text-muted-foreground text-sm"> / </span>
            <span className="text-green-500">{kpis.ativoCount}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Inativo / Mensal / Ativo</div>
        </Card>
        <Card className="shadow-subtle p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Atingimento Meta
            </h3>
          </div>
          <div className="text-lg sm:text-2xl font-bold">{kpis.achievementPct.toFixed(1)}%</div>
          <div className="text-[10px] text-muted-foreground">
            {formatCompactCurrency(kpis.totalAchieved)} / {formatCompactCurrency(kpis.totalTarget)}
          </div>
        </Card>
        <Card className="shadow-subtle p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground">
              Total Vendas
            </h3>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-primary">
            {formatCompactCurrency(kpis.totalSales)}
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {salesDelta >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            <span className={salesDelta >= 0 ? 'text-green-500' : 'text-red-500'}>
              {salesDelta >= 0 ? '+' : ''}
              {salesDeltaPct.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs mês anterior</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="text-sm">Comparativo Mensal</CardTitle>
            <CardDescription>Vendas e Atingimento</CardDescription>
          </CardHeader>
          <CardContent className="h-[240px]">
            <ChartContainer
              config={{
                sales: { label: 'Vendas', color: 'hsl(var(--primary))' },
                achieved: { label: 'Realizado', color: 'hsl(var(--chart-2))' },
              }}
              className="h-full w-full"
            >
              <BarChart data={monthComparisons} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
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
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                <Bar
                  dataKey="sales"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="achieved"
                  fill="hsl(var(--chart-2))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" /> Ranking de Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {vendorRanking.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Sem dados de vendedores
                </p>
              )}
              {vendorRanking.map((v, i) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}º</span>
                    <div>
                      <div className="font-medium text-sm">{v.nome}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatCurrency(v.totalSales)} em vendas
                      </div>
                    </div>
                  </div>
                  <span
                    className={`font-bold text-sm ${v.achievementPct >= 100 ? 'text-green-500' : v.achievementPct >= 50 ? 'text-yellow-500' : 'text-red-500'}`}
                  >
                    {v.achievementPct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
