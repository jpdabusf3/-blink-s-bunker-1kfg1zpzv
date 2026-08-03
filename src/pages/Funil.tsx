import { useState } from 'react'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, isStale, isPassedDeadline, isApproachingDeadline } from '@/lib/utils'
import { exportExecutiveMacroReport } from '@/lib/exportReports'
import { FunnelStage } from '@/types'
import {
  AlertTriangle,
  Clock,
  Calendar,
  Download,
  ListChecks,
  ArrowRight,
  User,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { FunilReviewMode } from '@/components/FunilReviewMode'
import { UserFilter } from '@/components/UserFilter'
import { isManager } from '@/lib/user-scope'
import { useAuth } from '@/hooks/use-auth'

const ANIMAL_SPECIES = [
  'Bovinos',
  'Suínos',
  'Aves',
  'Aqua',
  'PET',
  'Equinos',
  'Caprinos',
  'Ovinos',
  'Multiespécie',
]

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
  const allFactories = useScopedFactories()
  const { user } = useAuth()
  const canReview = isManager(user)
  const [reviewMode, setReviewMode] = useState(false)
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const factories = allFactories.filter(
    (f) =>
      (salesOwnerFilter === 'all' || f.salesOwner === salesOwnerFilter) &&
      (stateFilter === 'all' || f.state === stateFilter) &&
      (speciesFilter === 'all' || f.animalSpecies === speciesFilter),
  )
  const uniqueStates = Array.from(
    new Set(allFactories.map((f) => f.state).filter(Boolean) as string[]),
  ).sort()

  const handleExport = () => {
    exportExecutiveMacroReport(factories)
  }

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe as negociações, probabilidades e ações em cada etapa comercial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UserFilter
            value={salesOwnerFilter}
            onChange={setSalesOwnerFilter}
            className="w-[180px] h-9"
          />
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Estados</SelectItem>
              {uniqueStates.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Espécie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Espécies</SelectItem>
              {ANIMAL_SPECIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canReview && (
            <Button
              variant={reviewMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setReviewMode(!reviewMode)}
              className="gap-2 shadow-sm"
            >
              <ListChecks className="w-4 h-4" />
              {reviewMode ? 'Modo Kanban' : 'Modo Revisão (Priorização)'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 shadow-sm">
            <Download className="w-4 h-4" /> Exportar Executivo
          </Button>
        </div>
      </div>

      {reviewMode && canReview ? (
        <FunilReviewMode />
      ) : (
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
                      const nextStep = f.suggested_approach || f.notes

                      return (
                        <Card
                          key={f.id}
                          className={`p-3 shadow-subtle hover:shadow-md transition-all cursor-pointer border-l-4 ${
                            f.priority === 'High'
                              ? 'border-l-emerald-500'
                              : f.priority === 'Low'
                                ? 'border-l-destructive'
                                : 'border-l-amber-500'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <div className="font-bold text-sm leading-tight line-clamp-2">
                                {f.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {[f.city, f.profile_type].filter(Boolean).join(' • ')}
                              </div>
                            </div>
                            {stale && (
                              <AlertTriangle
                                className="w-4 h-4 text-destructive shrink-0"
                                title="Sem interação recente"
                              />
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                            <span className="text-muted-foreground">Potencial:</span>
                            <span className="text-primary font-bold">
                              {formatCurrency(f.potentialValue)}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                              <span>Probabilidade</span>
                              <span>{f.winProbability}%</span>
                            </div>
                            <Progress value={f.winProbability} className="h-1.5" />
                          </div>

                          {f.salesOwnerName && (
                            <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3 text-primary" />
                              <span className="truncate">Gestor: {f.salesOwnerName}</span>
                            </div>
                          )}

                          {nextStep && (
                            <div className="mt-2 text-[10px] bg-muted/60 p-1.5 rounded border text-muted-foreground">
                              <div className="font-semibold text-primary flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" /> Próximos Passos:
                              </div>
                              <p className="line-clamp-2 italic">{nextStep}</p>
                            </div>
                          )}

                          <div className="mt-2 pt-2 border-t space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                Contato: {new Date(f.lastInteraction).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            {f.deadline && (
                              <div
                                className={`flex items-center gap-1 text-[10px] ${
                                  passed
                                    ? 'text-destructive font-bold'
                                    : approaching
                                      ? 'text-amber-600 font-bold'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                <span>
                                  Prazo: {new Date(f.deadline).toLocaleDateString('pt-BR')}
                                </span>
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
      )}
    </div>
  )
}
