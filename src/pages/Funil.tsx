import { useAppContext } from '@/store/AppContext'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  formatCurrency,
  isStale,
  exportToCSV,
  isPassedDeadline,
  isApproachingDeadline,
} from '@/lib/utils'
import { FunnelStage } from '@/types'
import { AlertTriangle, Clock, Calendar, Download } from 'lucide-react'
import { Progress } from '@/components/ui/progress'

const STAGES: FunnelStage[] = [
  'Lead',
  'Primeiro Contato',
  'Diagnóstico Técnico',
  'Apresentação',
  'Teste/Trial',
  'Proposta',
  'Negociação',
  'Fechamento',
  'Pós-venda',
  'Perda',
]

export default function Funil() {
  const { factories } = useAppContext()

  const handleExport = () => {
    const data = factories.map((f) => ({
      'Nome da Fábrica': f.name,
      'Estágio Atual': f.funnelStage,
      'Probabilidade (%)': f.winProbability,
      'Valor Potencial (R$)': f.potentialValue,
      'Prazo Negociação': f.deadline ? new Date(f.deadline).toLocaleDateString('pt-BR') : '',
      'Última Interação': new Date(f.lastInteraction).toLocaleDateString('pt-BR'),
    }))
    exportToCSV('funil-vendas.csv', data)
  }

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe as negociações em cada etapa do processo comercial.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 shadow-sm">
          <Download className="w-4 h-4" /> Exportar Dados
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-4 min-w-max h-full items-stretch">
          {STAGES.map((stage) => {
            const items = factories.filter((f) => f.funnelStage === stage)
            const totalStageValue = items.reduce((s, f) => s + f.potentialValue, 0)

            return (
              <div
                key={stage}
                className="w-80 bg-muted/40 border rounded-xl flex flex-col max-h-full"
              >
                <div className="p-3 border-b bg-card/50 rounded-t-xl sticky top-0 z-10">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-sm text-foreground">{stage}</h3>
                    <Badge variant="secondary" className="font-mono">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {formatCurrency(totalStageValue)}
                  </div>
                </div>

                <div className="p-2 flex-1 overflow-y-auto space-y-3">
                  {items.map((f) => {
                    const stale = isStale(f.lastInteraction)
                    const passed = isPassedDeadline(f.deadline)
                    const approaching = isApproachingDeadline(f.deadline)

                    return (
                      <Card
                        key={f.id}
                        className={`p-3 shadow-subtle hover:shadow-md transition-shadow cursor-pointer border-l-4 ${stale || passed ? 'border-l-destructive' : 'border-l-primary'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-semibold text-sm leading-tight line-clamp-2">
                            {f.name}
                          </div>
                          {stale && (
                            <AlertTriangle
                              className="w-4 h-4 text-destructive shrink-0"
                              title="Sem interação recente"
                            />
                          )}
                        </div>
                        <div className="text-xs text-primary font-medium mt-2">
                          {formatCurrency(f.potentialValue)}
                        </div>

                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                            <span>Probabilidade</span>
                            <span>{f.winProbability}%</span>
                          </div>
                          <Progress value={f.winProbability} className="h-1.5" />
                        </div>

                        <div className="mt-3 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>
                              Último cont: {new Date(f.lastInteraction).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          {f.deadline && (
                            <div
                              className={`flex items-center gap-1 text-[10px] ${passed ? 'text-destructive font-bold' : approaching ? 'text-orange-500 font-bold' : 'text-muted-foreground'}`}
                            >
                              <Calendar className="w-3 h-3" />
                              <span>Prazo: {new Date(f.deadline).toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                  {items.length === 0 && (
                    <div className="text-center p-4 text-xs text-muted-foreground border border-dashed rounded-lg bg-transparent">
                      Sem oportunidades
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
