import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { TrendingUp, Award, Target as TargetIcon } from 'lucide-react'
import { useAppContext } from '@/store/AppContext'
import { getOrders } from '@/services/orders'
import { getTargets } from '@/services/targets'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCompactCurrency } from '@/lib/utils'
import type { Order, Target } from '@/types'
import { computeMilestones } from '@/lib/historical-comparison'

export function TimelineSummaryCard({
  regionFilter = 'Todas as Regiões',
}: {
  regionFilter?: string
}) {
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
  useRealtime('orders', loadData)
  useRealtime('targets', loadData)

  const milestones = useMemo(
    () => computeMilestones(orders, targets, factories, regionFilter),
    [orders, targets, factories, regionFilter],
  )

  const exceededCount = milestones.filter((m) => m.isExceeded).length
  const peakMilestone = milestones.find((m) => m.isPeak)
  const totalActual = milestones.reduce((s, m) => s + m.actual, 0)
  const totalTarget = milestones.reduce((s, m) => s + m.target, 0)
  const maxVal = Math.max(...milestones.map((x) => Math.max(x.actual, x.target)), 1)

  return (
    <Card className="shadow-subtle print:break-inside-avoid">
      <CardHeader>
        <CardTitle>Linha do Tempo de Performance</CardTitle>
        <CardDescription>Marcos e tendências dos últimos 12 meses</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-green-500/10">
            <TargetIcon className="w-4 h-4 mx-auto mb-1 text-green-500" />
            <p className="text-xs text-muted-foreground">Metas Atingidas</p>
            <p className="text-lg font-bold text-green-500">{exceededCount}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <Award className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground">Pico de Vendas</p>
            <p className="text-sm font-bold text-primary">{peakMilestone?.label || '—'}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-accent/10">
            <TrendingUp className="w-4 h-4 mx-auto mb-1 text-accent-foreground" />
            <p className="text-xs text-muted-foreground">Total 12m</p>
            <p className="text-sm font-bold">{formatCompactCurrency(totalActual)}</p>
          </div>
        </div>

        {totalActual === 0 && totalTarget === 0 ? (
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-center text-sm text-muted-foreground">
              Sem dados históricos disponíveis para este período
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-2">
              <div className="flex items-end gap-1 min-w-[500px] h-[120px]">
                {milestones.map((m) => {
                  const actualH = (m.actual / maxVal) * 100
                  const targetH = (m.target / maxVal) * 100
                  return (
                    <div
                      key={`${m.year}-${m.month}`}
                      className="flex-1 flex flex-col items-center gap-1 group relative"
                    >
                      <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-card border rounded px-1.5 py-0.5 shadow-sm z-10 whitespace-nowrap text-[9px] font-medium">
                        {formatCompactCurrency(m.actual)}
                      </div>
                      <div className="w-full flex-1 flex items-end justify-center gap-0.5">
                        <div
                          className={`w-1/2 rounded-t transition-all duration-300 ${m.isExceeded ? 'bg-green-500' : m.actual > 0 ? 'bg-primary' : 'bg-muted'}`}
                          style={{ height: `${Math.max(actualH, 2)}%` }}
                          title={`Realizado: ${formatCompactCurrency(m.actual)}`}
                        />
                        <div
                          className="w-1/2 rounded-t border border-dashed border-muted-foreground/40 bg-muted-foreground/10"
                          style={{ height: `${Math.max(targetH, 2)}%` }}
                          title={`Meta: ${formatCompactCurrency(m.target)}`}
                        />
                      </div>
                      <span
                        className={`text-[9px] ${m.isPeak ? 'font-bold text-primary' : 'text-muted-foreground'}`}
                      >
                        {m.label.split(' ')[0]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span>Realizado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border border-dashed border-muted-foreground/40 bg-muted-foreground/10" />
                <span>Meta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span>Meta Atingida</span>
              </div>
              {peakMilestone && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <Award className="w-3 h-3 text-primary" />
                  <span className="font-medium">
                    Pico: {peakMilestone.label} ({formatCompactCurrency(peakMilestone.actual)})
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
