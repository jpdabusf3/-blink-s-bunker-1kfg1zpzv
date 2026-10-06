import { useState, useRef, useCallback, useEffect } from 'react'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useAppContext } from '@/store/AppContext'
import { useGlobalData } from '@/store/GlobalDataProvider'
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
import { FunnelStage, type Factory } from '@/types'
import {
  AlertTriangle,
  Clock,
  Calendar,
  Download,
  ListChecks,
  ArrowRight,
  User,
  Loader2,
} from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { FunilReviewMode } from '@/components/FunilReviewMode'
import { UserFilter } from '@/components/UserFilter'
import { isManager } from '@/lib/user-scope'
import { useAuth } from '@/hooks/use-auth'
import { Link } from 'react-router-dom'
import { ClientDetailDrawer } from '@/components/ClientDetailDrawer'
import { factoryMatchesVendedor, type UnifiedVendedorOption } from '@/lib/vendedorFilterHelper'
import {
  buildSpeciesSegmentOptions,
  factoryMatchesSpeciesSegment,
} from '@/lib/funnelSpeciesSegmentFilter'
import { useToast } from '@/hooks/use-toast'
import { useIsMobile } from '@/hooks/use-mobile'
import { updateFactoryPB } from '@/services/factories'
import { logActivity } from '@/services/activity-logs'
import { notifyDataChanged } from '@/hooks/useRealtimeData'
import { FunnelCardActionBar } from '@/components/funil/FunnelCardActionBar'
import { FunnelCardContextMenuWrapper } from '@/components/funil/FunnelCardContextMenuWrapper'
import { QuickCallDialog } from '@/components/funil/QuickCallDialog'

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

import { useSearchParams } from 'react-router-dom'
import { highlightElement } from '@/lib/contextNavigation'

export default function Funil() {
  const allFactories = useScopedFactories()
  const { updateFactory } = useAppContext()
  const [searchParams] = useSearchParams()
  const { agenda_tasks: globalAgendaTasks, refreshCollection } = useGlobalData()
  const { user } = useAuth()
  const canReview = isManager(user)
  const [reviewMode, setReviewMode] = useState(false)
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')
  const [vendedorOptions, setVendedorOptions] = useState<UnifiedVendedorOption[]>([])
  const [stateFilter, setStateFilter] = useState('all')
  const [speciesSegmentFilter, setSpeciesSegmentFilter] = useState('all')
  const [overdueOnlyFilter, setOverdueOnlyFilter] = useState(false)

  const { toast } = useToast()
  const isMobile = useIsMobile()

  // Drawer de detalhes e histórico do cliente
  const [drawerClientId, setDrawerClientId] = useState<string | null>(null)
  const clickedCardRef = useRef<HTMLElement | null>(null)

  // Modal de ligação rápida
  const [quickCallClient, setQuickCallClient] = useState<Factory | null>(null)
  const [quickCallOpen, setQuickCallOpen] = useState(false)

  // Drag and drop state
  const [draggingFactoryId, setDraggingFactoryId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<FunnelStage | null>(null)
  const [touchDraggingFactory, setTouchDraggingFactory] = useState<Factory | null>(null)
  const [updatingFactoryIds, setUpdatingFactoryIds] = useState<Set<string>>(new Set())
  const touchStartCoord = useRef<{ x: number; y: number } | null>(null)
  const isTouchDragging = useRef<boolean>(false)

  // Mapa de clientes com follow-up atrasado (agenda_tasks com data no passado e status !== 'concluida')
  // Comparações feitas contra início do dia de hoje para identificar tarefas vencidas
  const overdueClientIds = new Set<string>()
  const todayDateStr = new Date().toISOString().split('T')[0]

  if (globalAgendaTasks && globalAgendaTasks.length > 0) {
    for (const task of globalAgendaTasks) {
      if (!task.deal_id) continue
      // Se já concluída ou cancelada, não conta como atrasada
      if (task.status === 'concluida' || task.status === 'cancelada') continue

      const cleanDate = (task.task_date || '').split(' ')[0].split('T')[0]
      if (cleanDate && cleanDate < todayDateStr) {
        overdueClientIds.add(task.deal_id)
      }
    }
  }

  const speciesSegmentOptions = buildSpeciesSegmentOptions(allFactories)

  const factories = allFactories.filter(
    (f) =>
      (salesOwnerFilter === 'all' ||
        factoryMatchesVendedor(f, salesOwnerFilter, vendedorOptions)) &&
      (stateFilter === 'all' || f.state === stateFilter) &&
      (speciesSegmentFilter === 'all' || factoryMatchesSpeciesSegment(f, speciesSegmentFilter)) &&
      (!overdueOnlyFilter || overdueClientIds.has(f.id)),
  )
  const uniqueStates = Array.from(
    new Set(allFactories.map((f) => f.state).filter(Boolean) as string[]),
  ).sort()

  const handleExport = () => {
    exportExecutiveMacroReport(factories)
  }

  const openDrawer = useCallback((factoryId: string, eventTarget?: HTMLElement | null) => {
    if (eventTarget) {
      clickedCardRef.current =
        (eventTarget.closest('[data-client-card]') as HTMLElement) || eventTarget
    }
    setDrawerClientId(factoryId)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerClientId(null)
  }, [])

  const handleClientUpdated = useCallback(
    (updated: Factory) => {
      updateFactory(updated.id, updated)
    },
    [updateFactory],
  )

  // Mover cliente para um novo estágio do funil com banco primeiro, rollback e toasts em português
  const handleMoveToStage = useCallback(
    async (factoryId: string, newStage: FunnelStage) => {
      if (updatingFactoryIds.has(factoryId)) return
      const targetFactory = allFactories.find((f) => f.id === factoryId)
      if (!targetFactory) return
      const oldStage = targetFactory.funnelStage
      if (oldStage === newStage) return

      setUpdatingFactoryIds((prev) => new Set(prev).add(factoryId))

      try {
        // 1. Atualiza primeiro o banco de dados via PocketBase
        await updateFactoryPB(factoryId, { funnelStage: newStage })

        // 2. Atualiza estado local somente após sucesso do banco
        updateFactory(factoryId, { funnelStage: newStage })

        // 3. Log isolado para que falha de log nunca bloqueie ou reverta o movimento
        try {
          await logActivity(
            `Estágio Funil: ${oldStage} → ${newStage}`,
            `Cliente: ${targetFactory.name}`,
            factoryId,
            'factories',
            {
              tipo: 'status',
              status_anterior: oldStage,
              status_novo: newStage,
              origem: 'funil',
            },
          )
        } catch (logErr) {
          console.warn('[Funil] Falha ao registrar logActivity (não impeditivo):', logErr)
        }

        // 4. Notifica barramento e recarrega dados para manter totais e contagens sincronizados
        notifyDataChanged('factories')
        await refreshCollection('factories').catch((e) => {
          console.warn('[Funil] Falha ao atualizar coleção factories:', e)
        })

        toast({
          title: 'Cliente movido',
          description: `Cliente movido para ${newStage}.`,
        })
      } catch (err: unknown) {
        console.error('[Funil] Falha ao mover estágio do cliente:', err)
        // Reverte posição original caso algum estado intermediário tenha mudado
        updateFactory(factoryId, { funnelStage: oldStage })
        toast({
          title: 'Erro ao mover cliente',
          description: 'Não foi possível mover o cliente. Tente novamente.',
          variant: 'destructive',
        })
      } finally {
        setUpdatingFactoryIds((prev) => {
          const next = new Set(prev)
          next.delete(factoryId)
          return next
        })
      }
    },
    [allFactories, updatingFactoryIds, updateFactory, refreshCollection, toast],
  )

  // Drop via arrastar e soltar (HTML5 DnD e Touch)
  const handleDropOnStage = useCallback(
    async (targetStage: FunnelStage, droppedFactoryId?: string) => {
      const factoryId = droppedFactoryId || draggingFactoryId
      setDragOverStage(null)
      setDraggingFactoryId(null)

      if (!factoryId) return
      if (updatingFactoryIds.has(factoryId)) return

      const targetFactory = allFactories.find((f) => f.id === factoryId)
      if (!targetFactory) return

      const oldStage = targetFactory.funnelStage
      // Edge case: soltar na mesma coluna não faz nada e não chama o banco
      if (oldStage === targetStage) return

      setUpdatingFactoryIds((prev) => new Set(prev).add(factoryId))

      try {
        // 1. Atualiza primeiro no PocketBase
        await updateFactoryPB(factoryId, { funnelStage: targetStage })

        // 2. Atualiza estado local apenas após sucesso no banco
        updateFactory(factoryId, { funnelStage: targetStage })

        // 3. Log isolado em try/catch para que falhas de log não bloqueiem ou revertam a ação
        try {
          await logActivity(
            `Estágio Funil (Drag&Drop): ${oldStage} → ${targetStage}`,
            `Cliente: ${targetFactory.name}`,
            factoryId,
            'factories',
            {
              tipo: 'status',
              status_anterior: oldStage,
              status_novo: targetStage,
              origem: 'funil',
            },
          )
        } catch (logErr) {
          console.warn('[Funil] Falha ao registrar logActivity (não impeditivo):', logErr)
        }

        // 4. Notifica barramento e recarrega dados para manter totais e contagens sincronizados
        notifyDataChanged('factories')
        await refreshCollection('factories').catch((e) => {
          console.warn('[Funil] Falha ao atualizar coleção factories:', e)
        })

        toast({
          title: 'Status atualizado',
          description: `${targetFactory.name} movido para ${targetStage}.`,
        })
      } catch (err: unknown) {
        console.error('[Funil] Falha no drag-and-drop de cliente:', err)
        // Rollback para coluna original
        updateFactory(factoryId, { funnelStage: oldStage })
        toast({
          title: 'Erro ao mover cliente',
          description: 'Não foi possível mover o cliente. Tente novamente.',
          variant: 'destructive',
        })
      } finally {
        setUpdatingFactoryIds((prev) => {
          const next = new Set(prev)
          next.delete(factoryId)
          return next
        })
      }
    },
    [draggingFactoryId, updatingFactoryIds, allFactories, updateFactory, refreshCollection, toast],
  )

  // Abertura ou destaque contextual de cliente no Funil (?cliente=ID ou ?highlight=ID)
  useEffect(() => {
    const targetId =
      searchParams.get('cliente') || searchParams.get('highlight') || searchParams.get('id')
    if (!targetId || allFactories.length === 0) return

    const timer = setTimeout(() => {
      const match = allFactories.find(
        (f) => f.id === targetId || f.name.toLowerCase() === targetId.toLowerCase(),
      )
      if (match) {
        setDrawerClientId(match.id)
        highlightElement(`funnel-card-${match.id}`)
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [searchParams, allFactories])

  // Atalhos de ação
  const handleOpenWhatsApp = useCallback(
    (factory: Factory) => {
      const rawPhone = factory.telefone || factory.contactPhone || ''
      const cleanPhone = rawPhone.replace(/\D/g, '')
      if (!cleanPhone) {
        toast({
          title: 'Telefone não cadastrado',
          description: 'O cliente não possui telefone válido para contato por WhatsApp.',
          variant: 'destructive',
        })
        return
      }
      const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
      const msg = encodeURIComponent(`Olá, ${factory.contactName || factory.name}!`)
      window.open(`https://wa.me/${fullNumber}?text=${msg}`, '_blank', 'noopener,noreferrer')
    },
    [toast],
  )

  const handleStartQuickCall = useCallback((factory: Factory) => {
    setQuickCallClient(factory)
    setQuickCallOpen(true)
  }, [])

  // Suporte a Touch Drag-and-Drop em Mobile
  const handleCardTouchStart = useCallback(
    (e: React.TouchEvent, factory: Factory) => {
      if (updatingFactoryIds.has(factory.id)) return
      if (e.touches.length !== 1) return
      const touch = e.touches[0]
      touchStartCoord.current = { x: touch.clientX, y: touch.clientY }
      isTouchDragging.current = false
    },
    [updatingFactoryIds],
  )

  const handleCardTouchMove = useCallback(
    (e: React.TouchEvent, factory: Factory) => {
      if (updatingFactoryIds.has(factory.id)) return
      if (e.touches.length !== 1 || !touchStartCoord.current) return
      const touch = e.touches[0]
      const dx = touch.clientX - touchStartCoord.current.x
      const dy = touch.clientY - touchStartCoord.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Se arrastou mais de 25px e o movimento é predominantemente horizontal
      if (dist > 25 && Math.abs(dx) > Math.abs(dy)) {
        if (!isTouchDragging.current) {
          isTouchDragging.current = true
          setTouchDraggingFactory(factory)
          setDraggingFactoryId(factory.id)
        }

        // Descobre sob qual coluna o dedo está
        const elementUnderPoint = document.elementFromPoint(touch.clientX, touch.clientY)
        const colElem = elementUnderPoint?.closest('[data-funnel-column]') as HTMLElement | null
        if (colElem) {
          const colStage = colElem.getAttribute('data-funnel-column') as FunnelStage
          if (colStage && colStage !== dragOverStage) {
            setDragOverStage(colStage)
          }
        } else {
          // Dedo fora de qualquer coluna
          if (dragOverStage !== null) {
            setDragOverStage(null)
          }
        }
      }
    },
    [updatingFactoryIds, dragOverStage],
  )

  const handleCardTouchEnd = useCallback(() => {
    const factory = touchDraggingFactory
    const stage = dragOverStage
    // Se soltou fora de qualquer coluna ou na mesma coluna, reverte sem erro
    if (isTouchDragging.current && factory && stage) {
      void handleDropOnStage(stage, factory.id)
    }
    isTouchDragging.current = false
    touchStartCoord.current = null
    setTouchDraggingFactory(null)
    setDraggingFactoryId(null)
    setDragOverStage(null)
  }, [touchDraggingFactory, dragOverStage, handleDropOnStage])

  // Fecha o overlay de touch dragging caso desmonte
  useEffect(() => {
    const handleGlobalTouchEnd = () => {
      if (isTouchDragging.current) {
        isTouchDragging.current = false
        touchStartCoord.current = null
        setTouchDraggingFactory(null)
        setDraggingFactoryId(null)
        setDragOverStage(null)
      }
    }
    window.addEventListener('touchend', handleGlobalTouchEnd)
    window.addEventListener('touchcancel', handleGlobalTouchEnd)
    return () => {
      window.removeEventListener('touchend', handleGlobalTouchEnd)
      window.removeEventListener('touchcancel', handleGlobalTouchEnd)
    }
  }, [])

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
            onOptionsLoaded={setVendedorOptions}
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
          <Select value={speciesSegmentFilter} onValueChange={setSpeciesSegmentFilter}>
            <SelectTrigger className="w-[170px] h-9" aria-label="Espécie ou Segmento">
              <SelectValue placeholder="Espécie / Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Espécies / Segmentos</SelectItem>
              {speciesSegmentOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={overdueOnlyFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOverdueOnlyFilter(!overdueOnlyFilter)}
            className={`gap-1.5 shadow-sm h-9 ${
              overdueOnlyFilter
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'hover:border-destructive/50'
            }`}
            aria-pressed={overdueOnlyFilter}
            title="Filtrar oportunidades com tarefas ou follow-ups atrasados"
          >
            <span className="w-2 h-2 rounded-full bg-destructive shrink-0 inline-block" />
            Follow-ups atrasados
            {overdueClientIds.size > 0 && (
              <Badge
                variant={overdueOnlyFilter ? 'secondary' : 'outline'}
                className="ml-1 px-1.5 py-0 text-[10px] h-4 font-mono"
              >
                {overdueClientIds.size}
              </Badge>
            )}
          </Button>
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
          <Button variant="outline" size="sm" asChild className="gap-2 shadow-sm">
            <Link to="/atividades">Atividades</Link>
          </Button>
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

              const isTargetColumn = dragOverStage === stage

              return (
                <div
                  key={stage}
                  data-funnel-column={stage}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverStage !== stage) {
                      setDragOverStage(stage)
                    }
                  }}
                  onDragLeave={(e) => {
                    // Se estiver saindo da coluna de fato (e não entrando em um filho)
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      if (dragOverStage === stage) {
                        setDragOverStage(null)
                      }
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    void handleDropOnStage(stage)
                  }}
                  className={`w-80 bg-muted/40 border rounded-xl flex flex-col max-h-full transition-all duration-200 ${
                    isTargetColumn
                      ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md'
                      : 'border-border'
                  }`}
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
                      const isBeingDragged = draggingFactoryId === f.id
                      const isUpdating = updatingFactoryIds.has(f.id)

                      return (
                        <FunnelCardContextMenuWrapper
                          key={f.id}
                          factory={f}
                          onMoveToStage={(newStg) => void handleMoveToStage(f.id, newStg)}
                          onOpenClient={() => openDrawer(f.id)}
                          onQuickCall={() => handleStartQuickCall(f)}
                        >
                          <Card
                            id={`funnel-card-${f.id}`}
                            data-client-card={f.id}
                            data-highlight-id={f.id}
                            tabIndex={0}
                            role="button"
                            aria-label={`Abrir detalhes de ${f.name}`}
                            aria-busy={isUpdating}
                            draggable={!isUpdating}
                            onDragStart={(e) => {
                              if (isUpdating) {
                                e.preventDefault()
                                return
                              }
                              setDraggingFactoryId(f.id)
                              e.dataTransfer.effectAllowed = 'move'
                              e.dataTransfer.setData('text/plain', f.id)
                            }}
                            onDragEnd={(e) => {
                              try {
                                setDraggingFactoryId(null)
                                setDragOverStage(null)
                              } catch (dragEndErr) {
                                console.error('[Funil] Erro no onDragEnd:', dragEndErr)
                                toast({
                                  title: 'Erro ao mover cliente',
                                  description: 'Não foi possível mover o cliente. Tente novamente.',
                                  variant: 'destructive',
                                })
                              }
                            }}
                            onTouchStart={(e) => handleCardTouchStart(e, f)}
                            onTouchMove={(e) => handleCardTouchMove(e, f)}
                            onTouchEnd={handleCardTouchEnd}
                            onClick={(e) => openDrawer(f.id, e.currentTarget)}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              openDrawer(f.id, e.currentTarget)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                openDrawer(f.id, e.currentTarget)
                              }
                            }}
                            className={`relative group p-3 shadow-subtle hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary border-l-4 ${
                              f.priority === 'High'
                                ? 'border-l-emerald-500'
                                : f.priority === 'Low'
                                  ? 'border-l-destructive'
                                  : 'border-l-amber-500'
                            } ${isBeingDragged ? 'opacity-40 scale-[0.98]' : ''} ${
                              isUpdating ? 'opacity-70 pointer-events-none cursor-wait' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sm leading-tight line-clamp-2">
                                    {f.name}
                                  </span>
                                  {isUpdating && (
                                    <Loader2
                                      className="w-3.5 h-3.5 text-primary animate-spin shrink-0"
                                      aria-label="Atualizando status..."
                                    />
                                  )}
                                  {!isUpdating && overdueClientIds.has(f.id) && (
                                    <span
                                      className="inline-block w-2.5 h-2.5 rounded-full bg-destructive shrink-0 animate-pulse"
                                      role="status"
                                      aria-label="Follow-up atrasado neste cliente"
                                      title="Follow-up atrasado na agenda"
                                    />
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  {[f.city, f.profile_type].filter(Boolean).join(' • ')}
                                </div>
                              </div>
                              {stale && (
                                <span title="Sem interação recente">
                                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                                </span>
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

                            {/* Barra de atalhos rápidos revelada no hover em desktop */}
                            {!isMobile && (
                              <FunnelCardActionBar
                                factory={f}
                                onQuickCall={(e) => {
                                  e.stopPropagation()
                                  handleStartQuickCall(f)
                                }}
                                onWhatsApp={(e) => {
                                  e.stopPropagation()
                                  handleOpenWhatsApp(f)
                                }}
                                onOpenDrawer={(e) => {
                                  e.stopPropagation()
                                  openDrawer(
                                    f.id,
                                    (e.target as HTMLElement).closest('[data-client-card]'),
                                  )
                                }}
                              />
                            )}
                          </Card>
                        </FunnelCardContextMenuWrapper>
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

      {/* Drawer unificado de interação com cliente e histórico de ações */}
      <ClientDetailDrawer
        clientId={drawerClientId}
        initialClient={allFactories.find((f) => f.id === drawerClientId) || null}
        open={!!drawerClientId}
        onClose={closeDrawer}
        onClientUpdated={handleClientUpdated}
        triggerRef={clickedCardRef}
        mode="funil"
        origin="funil"
      />

      {/* Modal de ligação rápida */}
      <QuickCallDialog
        client={quickCallClient}
        open={quickCallOpen}
        onOpenChange={(isOpen) => {
          setQuickCallOpen(isOpen)
          if (!isOpen) setQuickCallClient(null)
        }}
        onSuccess={(updatedClient) => {
          handleClientUpdated(updatedClient)
        }}
      />
    </div>
  )
}
