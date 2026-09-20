import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  agendaService,
  type AgendaTask,
  type AgendaTaskInput,
  type AgendaTaskStatus,
  type DealOption,
  buildActivityTextCreated,
  buildActivityTextCompleted,
  buildActivityTextCancelled,
  getNextFunnelStage,
} from '@/services/agenda-service'
import { recordDealActivity } from '@/services/deal-activities'
import { updateFactoryPB } from '@/services/factories'
import { AgendaTaskCard } from '@/components/agenda/AgendaTaskCard'
import { AgendaTaskModal } from '@/components/agenda/AgendaTaskModal'
import { DeleteTaskDialog } from '@/components/agenda/DeleteTaskDialog'
import { AgendaFunnelConfirmDialog } from '@/components/agenda/AgendaFunnelConfirmDialog'
import { AgendaHeader, type WeekDayItem } from '@/components/agenda/AgendaHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useUsers } from '@/hooks/use-users'
import { Calendar as CalendarIcon, Plus, RotateCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Helpers for date calculations
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  // day: 0 (Sun), 1 (Mon), ..., 6 (Sat). Monday = 0
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(date.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d)
  res.setDate(res.getDate() + days)
  return res
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateBR(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

const WEEKDAY_NAMES = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
]

const WEEKDAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function AgendaSemanal() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { users } = useUsers()

  // Week navigation state (Monday of current week)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()))

  // Data states
  const [tasks, setTasks] = useState<AgendaTask[]>([])
  const [deals, setDeals] = useState<DealOption[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)

  // Filters state
  const [typeFilter, setTypeFilter] = useState<string>('todas')
  const [statusFilter, setStatusFilter] = useState<string>('todas')
  const [vendorFilter, setVendorFilter] = useState<string>('todos')
  const [selectedDayStr, setSelectedDayStr] = useState<string>('todas')

  // Mobile selected day index (0 to 6)
  const [selectedDayIndexMobile, setSelectedDayIndexMobile] = useState<number>(0)

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<AgendaTask | null>(null)
  const [newTaskInitialDate, setNewTaskInitialDate] = useState<string>('')

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<AgendaTask | null>(null)

  // Funnel confirmation dialog state (Regra 2)
  const [funnelConfirmOpen, setFunnelConfirmOpen] = useState(false)
  const [taskForFunnelConfirm, setTaskForFunnelConfirm] = useState<AgendaTask | null>(null)

  // Calculate 7 days of the week [Mon -> Sun]
  const weekDays: WeekDayItem[] = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentMonday, i)
      const dateStr = formatDateISO(date)
      return {
        index: i,
        date,
        dateStr,
        dayOfMonth: date.getDate(),
        month: date.getMonth() + 1,
        dayName: WEEKDAY_NAMES[i],
        dayNameShort: WEEKDAY_NAMES_SHORT[i],
        displayDate: formatDateBR(date),
      }
    })
  }, [currentMonday])

  const sunday = weekDays[6].date
  const todayStr = formatDateISO(new Date())

  // Header date range like "15/09 – 21/09"
  const weekRangeLabel = `${formatDateBR(currentMonday)} – ${formatDateBR(sunday)}`

  // Map user ID -> user name
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (user?.id && user?.name) {
      map.set(user.id, user.name)
    }
    for (const u of users) {
      if (u.id && u.name) {
        map.set(u.id, u.name)
      }
    }
    return map
  }, [user, users])

  // Fetch tasks and deals
  const loadData = useCallback(async () => {
    setLoading(true)
    setHasError(false)
    try {
      const startStr = formatDateISO(currentMonday)
      const endStr = formatDateISO(sunday)

      const [loadedTasks, loadedDeals] = await Promise.all([
        agendaService.listTasks(startStr, endStr),
        agendaService.listDeals(),
      ])

      // Attach resolved user_name if missing
      const enrichedTasks = loadedTasks.map((t) => {
        const vendorName =
          (t as any).expand?.user_id?.name ||
          (t.user_id ? userNameMap.get(t.user_id) : undefined) ||
          (user?.id === t.user_id ? user?.name : undefined) ||
          'Vendedor'
        return {
          ...t,
          user_name: vendorName,
        }
      })

      setTasks(enrichedTasks)
      setDeals(loadedDeals)
    } catch (err) {
      console.error('Erro ao carregar dados da agenda:', err)
      setHasError(true)
    } finally {
      setLoading(false)
    }
  }, [currentMonday, sunday, userNameMap, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Week navigation handlers
  const handlePrevWeek = () => {
    setCurrentMonday((prev) => addDays(prev, -7))
  }

  const handleNextWeek = () => {
    setCurrentMonday((prev) => addDays(prev, 7))
  }

  const handleToday = () => {
    const mon = getMonday(new Date())
    setCurrentMonday(mon)

    // Set mobile index to today if inside current week
    const nowDay = new Date().getDay()
    const index = nowDay === 0 ? 6 : nowDay - 1
    setSelectedDayIndexMobile(index)
    setSelectedDayStr('todas')
  }

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (typeFilter !== 'todas' && task.task_type !== typeFilter) {
        return false
      }
      if (statusFilter !== 'todas' && task.status !== statusFilter) {
        return false
      }
      if (vendorFilter !== 'todos') {
        const taskVendor = (task as any).user_name || (task as any).expand?.user_id?.name
        if (taskVendor !== vendorFilter) {
          return false
        }
      }
      if (selectedDayStr !== 'todas') {
        const taskDateOnly = task.task_date ? task.task_date.split(' ')[0].split('T')[0] : ''
        if (taskDateOnly !== selectedDayStr) {
          return false
        }
      }
      return true
    })
  }, [tasks, typeFilter, statusFilter, vendorFilter, selectedDayStr])

  // Group filtered tasks by day (dateStr: YYYY-MM-DD)
  const tasksByDay = useMemo(() => {
    const map: Record<string, AgendaTask[]> = {}
    for (const d of weekDays) {
      map[d.dateStr] = []
    }

    for (const t of filteredTasks) {
      const taskDateOnly = t.task_date ? t.task_date.split(' ')[0].split('T')[0] : ''
      if (map[taskDateOnly]) {
        map[taskDateOnly].push(t)
      }
    }

    // Sort each day's tasks by start_time (empty string sorts after timed tasks)
    for (const d of weekDays) {
      map[d.dateStr].sort((a, b) => {
        const timeA = a.start_time || '99:99'
        const timeB = b.start_time || '99:99'
        return timeA.localeCompare(timeB)
      })
    }

    return map
  }, [filteredTasks, weekDays])

  // Tasks by day for all tasks in week (used in day chips counters)
  const allTasksByDay = useMemo(() => {
    const map: Record<string, AgendaTask[]> = {}
    for (const d of weekDays) {
      map[d.dateStr] = []
    }
    for (const t of tasks) {
      const taskDateOnly = t.task_date ? t.task_date.split(' ')[0].split('T')[0] : ''
      if (map[taskDateOnly]) {
        map[taskDateOnly].push(t)
      }
    }
    return map
  }, [tasks, weekDays])

  const totalTasksInWeek = filteredTasks.length

  // Action handlers
  const handleOpenCreateModal = (initialDate?: string) => {
    setEditingTask(null)
    setNewTaskInitialDate(initialDate || todayStr)
    setModalOpen(true)
  }

  const handleOpenEditModal = (task: AgendaTask) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const handleSaveTask = async (payload: AgendaTaskInput, taskId?: string) => {
    try {
      if (taskId) {
        const updated = await agendaService.updateTask(taskId, payload)
        const enriched = {
          ...updated,
          user_name:
            userNameMap.get(updated.user_id) ||
            (user?.id === updated.user_id ? user?.name : undefined) ||
            'Vendedor',
        }
        setTasks((prev) => prev.map((t) => (t.id === taskId ? enriched : t)))
        toast({
          title: 'Sucesso',
          description: 'Tarefa atualizada',
        })
      } else {
        const created = await agendaService.createTask(payload)
        const enriched = {
          ...created,
          user_name:
            userNameMap.get(created.user_id) ||
            (user?.id === created.user_id ? user?.name : undefined) ||
            'Vendedor',
        }
        setTasks((prev) => [...prev, enriched])
        toast({
          title: 'Sucesso',
          description: 'Tarefa criada',
        })

        if (created.deal_id) {
          try {
            const text = buildActivityTextCreated(
              created.task_type,
              created.title,
              created.task_date,
            )
            await recordDealActivity({
              dealId: created.deal_id,
              activityText: text,
            })
          } catch (actErr) {
            console.error('Erro isolado ao registrar atividade no negócio:', actErr)
          }
        }
      }
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar a tarefa',
      })
      throw err
    }
  }

  const handleToggleConcluida = async (task: AgendaTask, e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus: AgendaTaskStatus = task.status === 'concluida' ? 'agendada' : 'concluida'
    try {
      const updated = await agendaService.updateStatus(task.id, newStatus)
      const enriched = {
        ...updated,
        user_name: (task as any).user_name || userNameMap.get(updated.user_id) || 'Vendedor',
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? enriched : t)))
      toast({
        title: 'Sucesso',
        description: newStatus === 'concluida' ? 'Tarefa concluída' : 'Tarefa atualizada',
      })

      if (newStatus === 'concluida' && updated.deal_id) {
        try {
          const text = buildActivityTextCompleted(updated.task_type, updated.title)
          await recordDealActivity({
            dealId: updated.deal_id,
            activityText: text,
          })
        } catch (actErr) {
          console.error('Erro isolado ao registrar atividade de conclusão:', actErr)
        }

        setTaskForFunnelConfirm(enriched)
        setFunnelConfirmOpen(true)
      }
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a tarefa',
      })
    }
  }

  const handleCancelTask = async (task: AgendaTask, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const updated = await agendaService.updateStatus(task.id, 'cancelada')
      const enriched = {
        ...updated,
        user_name: (task as any).user_name || userNameMap.get(updated.user_id) || 'Vendedor',
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? enriched : t)))
      toast({
        title: 'Sucesso',
        description: 'Tarefa atualizada',
      })

      if (updated.deal_id) {
        try {
          const text = buildActivityTextCancelled(updated.task_type, updated.title)
          await recordDealActivity({
            dealId: updated.deal_id,
            activityText: text,
          })
        } catch (actErr) {
          console.error('Erro isolado ao registrar cancelamento no negócio:', actErr)
        }
      }
    } catch (err) {
      console.error('Erro ao cancelar tarefa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a tarefa',
      })
    }
  }

  // Funnel confirm handlers
  const handleFunnelConfirmKeep = () => {
    setFunnelConfirmOpen(false)
    setTaskForFunnelConfirm(null)
  }

  const handleFunnelConfirmMove = async () => {
    if (!taskForFunnelConfirm || !taskForFunnelConfirm.deal_id) return
    const currentDeal = deals.find((d) => d.id === taskForFunnelConfirm.deal_id)
    const currentStage =
      currentDeal?.funnelStage || taskForFunnelConfirm.expand?.deal_id?.funnelStage || 'Lead'
    const nextStage = getNextFunnelStage(currentStage)

    if (!nextStage) return

    try {
      await updateFactoryPB(taskForFunnelConfirm.deal_id, {
        funnelStage: nextStage,
      } as any)

      setDeals((prev) =>
        prev.map((d) =>
          d.id === taskForFunnelConfirm.deal_id ? { ...d, funnelStage: nextStage } : d,
        ),
      )

      toast({
        title: 'Sucesso',
        description: `Negócio avançado para a etapa ${nextStage}`,
      })
    } catch (dealErr) {
      console.error('Erro ao atualizar etapa do funil:', dealErr)
      toast({
        variant: 'destructive',
        title: 'Aviso',
        description:
          'Tarefa concluída, mas não foi possível atualizar o funil. Tente novamente pelo negócio.',
      })
    } finally {
      setFunnelConfirmOpen(false)
      setTaskForFunnelConfirm(null)
    }
  }

  const handleFunnelConfirmRevert = async () => {
    if (!taskForFunnelConfirm) return
    try {
      const reverted = await agendaService.updateStatus(taskForFunnelConfirm.id, 'agendada')
      const enriched = {
        ...reverted,
        user_name: (taskForFunnelConfirm as any).user_name || 'Vendedor',
      }
      setTasks((prev) => prev.map((t) => (t.id === reverted.id ? enriched : t)))
      toast({
        title: 'Sucesso',
        description: 'Tarefa revertida para agendada',
      })
    } catch (revErr) {
      console.error('Erro ao reverter tarefa:', revErr)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível reverter a tarefa',
      })
    } finally {
      setFunnelConfirmOpen(false)
      setTaskForFunnelConfirm(null)
    }
  }

  const handleDeleteTaskClick = (task: AgendaTask, e: React.MouseEvent) => {
    e.stopPropagation()
    setTaskToDelete(task)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return
    const id = taskToDelete.id
    try {
      await agendaService.deleteTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      toast({
        title: 'Sucesso',
        description: 'Tarefa excluída',
      })
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível excluir a tarefa',
      })
    } finally {
      setDeleteDialogOpen(false)
      setTaskToDelete(null)
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Extracted AgendaHeader */}
      <AgendaHeader
        title="Agenda"
        weekRangeLabel={weekRangeLabel}
        weekDays={weekDays}
        todayStr={todayStr}
        selectedDayStr={selectedDayStr}
        onSelectDay={setSelectedDayStr}
        vendorFilter={vendorFilter}
        onVendorFilterChange={setVendorFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onNewTask={() => handleOpenCreateModal()}
        tasks={tasks}
        tasksByDay={allTasksByDay}
      />

      {/* STATE 1: LOADING SKELETON */}
      {loading && (
        <div className="space-y-4">
          <div className="hidden md:grid md:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-[var(--radius)] border border-border bg-card p-3 space-y-3"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
            ))}
          </div>
          <div className="md:hidden space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-28 w-full rounded-md" />
            <Skeleton className="h-28 w-full rounded-md" />
          </div>
        </div>
      )}

      {/* STATE 2: ERROR */}
      {!loading && hasError && (
        <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center space-y-4 border border-destructive/30 rounded-[var(--radius)] bg-[hsl(var(--destructive)/0.05)]">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">
              Não foi possível carregar a agenda
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Ocorreu uma instabilidade ao conectar ao servidor. Verifique sua conexão e tente
              novamente.
            </p>
          </div>
          <Button onClick={loadData} variant="default" className="gap-2 min-h-[44px]">
            <RotateCw className="w-4 h-4" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* STATE 3: EMPTY */}
      {!loading && !hasError && totalTasksInWeek === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[380px] p-8 text-center space-y-4 border border-border rounded-[var(--radius)] bg-card shadow-sm">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <CalendarIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-lg font-bold text-foreground">Nenhuma tarefa encontrada</h3>
            <p className="text-sm text-muted-foreground">
              Não encontramos tarefas com os filtros selecionados para esta semana.
            </p>
          </div>
          <Button onClick={() => handleOpenCreateModal()} className="gap-2 shadow-sm min-h-[44px]">
            <Plus className="w-4 h-4" />
            Nova tarefa
          </Button>
        </div>
      )}

      {/* STATE 4: SUCCESS - CALENDAR VIEW */}
      {!loading && !hasError && totalTasksInWeek > 0 && (
        <div>
          {/* DESKTOP VIEW (>= 768px): 7 columns Monday -> Sunday */}
          <div className="hidden md:grid md:grid-cols-7 gap-3 items-start">
            {weekDays.map((day) => {
              const isToday = day.dateStr === todayStr
              const dayTasks = tasksByDay[day.dateStr] || []

              return (
                <div
                  key={day.dateStr}
                  className={cn(
                    'flex flex-col min-h-[480px] rounded-[var(--radius)] border border-border bg-card transition-all',
                    isToday
                      ? 'border-primary ring-1 ring-primary/40 shadow-sm bg-primary/[0.02]'
                      : 'hover:border-border',
                  )}
                >
                  {/* Column Header */}
                  <div
                    className={cn(
                      'p-2.5 border-b border-border flex items-center justify-between rounded-t-[var(--radius)] transition-colors',
                      isToday ? 'bg-primary/10' : 'bg-muted/20',
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-xs font-semibold capitalize',
                            isToday ? 'text-primary font-bold' : 'text-foreground',
                          )}
                        >
                          {day.dayNameShort}
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary text-primary-foreground">
                            Hoje
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {day.displayDate}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      title={`Adicionar tarefa em ${day.displayDate}`}
                      aria-label={`Adicionar tarefa em ${day.displayDate}`}
                      onClick={() => handleOpenCreateModal(day.dateStr)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Tasks Column Body */}
                  <div className="p-2 flex-1 space-y-2">
                    {dayTasks.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-center p-2 text-muted-foreground/50 border border-dashed border-border/40 rounded-md">
                        <p className="text-[11px] italic">Sem tarefas</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenCreateModal(day.dateStr)}
                          className="min-h-[44px] text-xs mt-1 text-muted-foreground hover:text-foreground gap-1 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Agendar
                        </Button>
                      </div>
                    ) : (
                      dayTasks.map((t) => (
                        <AgendaTaskCard
                          key={t.id}
                          task={t}
                          vendorName={(t as any).user_name}
                          onClick={handleOpenEditModal}
                          onToggleConcluida={handleToggleConcluida}
                          onCancelTask={handleCancelTask}
                          onDeleteTask={handleDeleteTaskClick}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* MOBILE VIEW (< 768px): Day Selector + Vertical Task List for selected day */}
          <div className="md:hidden space-y-4">
            {/* Day Selector Pills */}
            <div className="grid grid-cols-7 gap-1 p-1 bg-muted/40 rounded-[var(--radius)] border border-border">
              {weekDays.map((day, idx) => {
                const isSelected = idx === selectedDayIndexMobile
                const isToday = day.dateStr === todayStr
                const taskCount = (tasksByDay[day.dateStr] || []).length

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => setSelectedDayIndexMobile(idx)}
                    className={cn(
                      'relative flex flex-col items-center justify-center py-2 px-1 rounded-md text-xs font-medium transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                      isToday && !isSelected && 'text-primary font-semibold',
                    )}
                  >
                    <span className="text-[10px] uppercase">{day.dayNameShort.slice(0, 3)}</span>
                    <span className="text-sm">{day.dayOfMonth}</span>

                    {taskCount > 0 && (
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full mt-0.5',
                          isSelected ? 'bg-primary-foreground' : 'bg-primary',
                        )}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected Day Header & Cards (stack full width) */}
            {(() => {
              const activeDay = weekDays[selectedDayIndexMobile]
              const isToday = activeDay.dateStr === todayStr
              const dayTasks = tasksByDay[activeDay.dateStr] || []

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-[var(--radius)] border border-border bg-card">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base text-foreground">
                          {activeDay.dayName}
                        </h3>
                        {isToday && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-primary text-primary-foreground">
                            Hoje
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {activeDay.displayDate} • {dayTasks.length}{' '}
                        {dayTasks.length === 1 ? 'tarefa' : 'tarefas'}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleOpenCreateModal(activeDay.dateStr)}
                      className="gap-1.5 min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </Button>
                  </div>

                  {/* Tasks for selected mobile day */}
                  <div className="space-y-2.5">
                    {dayTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center rounded-[var(--radius)] border border-dashed border-border bg-card/40 text-muted-foreground">
                        <CalendarIcon className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm font-medium">Nenhuma tarefa para este dia</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCreateModal(activeDay.dateStr)}
                          className="mt-3 gap-1.5 min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Criar tarefa
                        </Button>
                      </div>
                    ) : (
                      dayTasks.map((t) => (
                        <AgendaTaskCard
                          key={t.id}
                          task={t}
                          vendorName={(t as any).user_name}
                          onClick={handleOpenEditModal}
                          onToggleConcluida={handleToggleConcluida}
                          onCancelTask={handleCancelTask}
                          onDeleteTask={handleDeleteTaskClick}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Task Creation / Edit Modal */}
      <AgendaTaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        initialDate={newTaskInitialDate}
        deals={deals}
        onSave={handleSaveTask}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        task={taskToDelete}
        onConfirm={handleConfirmDelete}
      />

      {/* Funnel Confirmation Dialog (Regra 2) */}
      <AgendaFunnelConfirmDialog
        open={funnelConfirmOpen}
        onOpenChange={(v) => {
          setFunnelConfirmOpen(v)
          if (!v) setTaskForFunnelConfirm(null)
        }}
        task={taskForFunnelConfirm}
        dealStage={
          deals.find((d) => d.id === taskForFunnelConfirm?.deal_id)?.funnelStage ||
          taskForFunnelConfirm?.expand?.deal_id?.funnelStage
        }
        onKeepStage={handleFunnelConfirmKeep}
        onMoveToNextStage={handleFunnelConfirmMove}
        onCancelTask={handleFunnelConfirmRevert}
      />
    </div>
  )
}
