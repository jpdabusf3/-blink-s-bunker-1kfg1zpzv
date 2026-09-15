import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { fetchGestorComparison, type GestorRanking } from '@/services/consolidated-dashboard'
import { formatCompactCurrency } from '@/lib/utils'
import { Loader2, TrendingUp, TrendingDown, UserCog } from 'lucide-react'

export function GestorTecnicoComparisonCard() {
  const [data, setData] = useState<GestorRanking[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      setData(await fetchGestorComparison())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtimeData('metas', loadData)
  useRealtimeData('historico_vendas', loadData)

  if (loading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  if (!data.length) return null

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCog className="w-4 h-4 text-primary" /> Comparativo por Gestor Técnico
        </CardTitle>
        <CardDescription>Realizado vs Meta com evolução mensal</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {data.map((g) => {
            const delta = g.curMonthSales - g.prevMonthSales
            const deltaPct = g.prevMonthSales > 0 ? (delta / g.prevMonthSales) * 100 : 0
            return (
              <div key={g.id} className="p-3 rounded-lg bg-muted/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{g.nome}</span>
                  <span
                    className={`font-bold text-sm ${g.achievementPct >= 100 ? 'text-green-500' : g.achievementPct >= 50 ? 'text-yellow-500' : 'text-red-500'}`}
                  >
                    {g.achievementPct.toFixed(0)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Meta: </span>
                    <span className="font-medium">{formatCompactCurrency(g.metaValor)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Realizado: </span>
                    <span className="font-medium">{formatCompactCurrency(g.valorRealizado)}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px]">
                  {delta >= 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className={delta >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {delta >= 0 ? '+' : ''}
                    {deltaPct.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground">
                    vs mês anterior ({formatCompactCurrency(g.totalSales)} total)
                  </span>
                </div>
                <div className="mt-2 w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${g.achievementPct >= 100 ? 'bg-green-500' : g.achievementPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(g.achievementPct, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
