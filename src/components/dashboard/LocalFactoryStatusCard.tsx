import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { useAppContext } from '@/store/AppContext'
import { isStale } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export function LocalFactoryStatusCard({
  regionFilter = 'Todas as Regiões',
}: {
  regionFilter?: string
}) {
  const { factories } = useAppContext()

  const filtered = useMemo(() => {
    if (regionFilter === 'Todas as Regiões') return factories
    return factories.filter((f) => f.region === regionFilter || f.stateRegion === regionFilter)
  }, [factories, regionFilter])

  const stats = useMemo(() => {
    return {
      active: filtered.filter((f) => f.status === 'Atendido').length,
      prospect: filtered.filter((f) => f.status === 'Prospeção').length,
      inactive: filtered.filter((f) => f.status === 'Não atendido').length,
      total: filtered.length,
    }
  }, [filtered])

  const needsAttention = useMemo(() => {
    return filtered.filter((f) => isStale(f.lastInteraction) || f.priority === 'High').slice(0, 5)
  }, [filtered])

  const statusItems = [
    { label: 'Atendidas', value: stats.active, color: 'text-green-500', icon: CheckCircle2 },
    { label: 'Prospecção', value: stats.prospect, color: 'text-yellow-500', icon: Clock },
    { label: 'Inativas', value: stats.inactive, color: 'text-destructive', icon: AlertTriangle },
  ]

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Status Local de Fábricas</CardTitle>
        <CardDescription>
          {regionFilter !== 'Todas as Regiões' ? regionFilter : 'Todas as regiões'} ({stats.total}{' '}
          total)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {statusItems.map((item) => (
            <div key={item.label} className="text-center p-3 bg-muted/30 rounded-lg">
              <item.icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
        {needsAttention.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Precisam de Atenção
            </p>
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
              {needsAttention.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between text-xs p-2 bg-destructive/5 rounded-md"
                >
                  <span className="font-medium truncate">{f.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap ml-2">
                    {isStale(f.lastInteraction) ? 'Sem interação 15+ dias' : 'Alta prioridade'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
