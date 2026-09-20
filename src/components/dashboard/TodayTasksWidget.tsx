import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ArrowRight,
} from 'lucide-react'
import type { RecordSubscription } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { TaskBadge } from '@/components/agenda/TaskBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface TodayTaskItem {
  id: string
  user_id: string
  title: string
  task_type: string
  client_name?: string
  task_date: string
  start_time?: string
  end_time?: string
  status: 'agendada' | 'concluida' | 'cancelada'
  notes?: string
}

function getTodayISODate(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function TodayTasksWidget() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [tasks, setTasks] = useState<TodayTaskItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isError, setIsError] = useState<boolean>(false)
  const [mounted, setMounted] = useState<boolean>(false)

  // Use a ref to keep current user id for realtime callback comparisons
  const userIdRef = useRef<string | undefined>(user?.id)
  userIdRef.current = user?.id

  const loadTodayTasks = useCallback(async () => {
    const currentUserId = user?.id || pb.authStore.record?.id
    if (!currentUserId) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    setIsError(false)

    try {
      const today = getTodayISODate()
      // Filter by task_date starting with today AND user_id = current logged user
      const filter = `user_id = "${currentUserId}" && task_date >= "${today} 00:00:00" && task_date <= "${today} 23:59:59"`

      const records = await pb.collection('agenda_tasks').getFullList<TodayTaskItem>({
        filter,
        sort: 'start_time,created',
        fields: 'id,user_id,title,task_type,client_name,task_date,start_time,end_time,status,notes',
      })

      // Sort client-side by start_time ascending (timed tasks first, empty times at end)
      const sorted = [...records].sort((a, b) => {
        const timeA = a.start_time?.trim() || '99:99'
        const timeB = b.start_time?.trim() || '99:99'
        return timeA.localeCompare(timeB)
      })

      setTasks(sorted)
    } catch (err) {
      console.error('Erro ao carregar tarefas de hoje:', err)
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadTodayTasks()
  }, [loadTodayTasks])

  // Realtime subscription to agenda_tasks
  useEffect(() => {
    const currentUserId = user?.id || pb.authStore.record?.id
    if (!currentUserId) return

    let unsubscribeFn: (() => Promise<void>) | undefined
    let isCancelled = false

    const today = getTodayISODate()

    const handleRealtimeEvent = (e: RecordSubscription<TodayTaskItem>) => {
      const item = e.record
      // Check if relevant to this user
      if (item.user_id && item.user_id !== userIdRef.current) {
        return
      }

      const itemDateOnly = item.task_date ? item.task_date.split(' ')[0].split('T')[0] : ''

      if (e.action === 'delete') {
        setTasks((prev) => prev.filter((t) => t.id !== item.id))
        return
      }

      if (itemDateOnly !== today) {
        // If an updated task changed date away from today, remove it from the list
        setTasks((prev) => prev.filter((t) => t.id !== item.id))
        return
      }

      // Add or update task in list
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === item.id)
        let nextList: TodayTaskItem[]
        if (exists) {
          nextList = prev.map((t) => (t.id === item.id ? item : t))
        } else {
          nextList = [...prev, item]
        }
        return nextList.sort((a, b) => {
          const timeA = a.start_time?.trim() || '99:99'
          const timeB = b.start_time?.trim() || '99:99'
          return timeA.localeCompare(timeB)
        })
      })
    }

    pb.collection<TodayTaskItem>('agenda_tasks')
      .subscribe('*', handleRealtimeEvent)
      .then((unsub) => {
        if (isCancelled) {
          unsub().catch(() => {})
        } else {
          unsubscribeFn = unsub
        }
      })
      .catch((err) => {
        console.error('Erro ao subscrever atualizações da agenda:', err)
        toast({
          variant: 'destructive',
          title: 'Erro de conexão em tempo real',
          description: 'Não foi possível conectar ao serviço de atualizações da agenda.',
        })
      })

    return () => {
      isCancelled = true
      if (unsubscribeFn) {
        unsubscribeFn().catch(() => {})
      }
    }
  }, [user?.id, toast])

  // Trigger smooth progress bar animation on load
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Calculations for counter badge & progress bar
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'concluida').length
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Display at most 5 tasks
  const visibleTasks = tasks.slice(0, 5)
  const hasMoreThan5 = totalTasks > 5

  return (
    <div
      data-testid="today-tasks-widget"
      className="col-span-1 lg:col-span-1 rounded-[var(--radius)] bg-[var(--card)] p-[20px] shadow-sm border border-border text-card-foreground flex flex-col justify-between"
    >
      {/* 1. HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-border/40 gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-primary shrink-0" />
          <h3 className="font-semibold text-lg text-foreground leading-tight">Tarefas de hoje</h3>
        </div>

        {!loading && !isError && totalTasks > 0 && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary)] text-white shrink-0">
            {completedTasks} de {totalTasks}
          </span>
        )}
      </div>

      {/* 2. UX STATES */}

      {/* STATE 1: LOADING SKELETON */}
      {loading && (
        <div className="py-4 space-y-3 flex-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/20 animate-pulse"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STATE 2: ERROR */}
      {!loading && isError && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-xs">
            <p className="text-sm font-medium text-foreground">
              Não foi possível carregar as tarefas de hoje.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadTodayTasks()}
            className="gap-1.5 text-xs h-8"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* STATE 3: EMPTY */}
      {!loading && !isError && totalTasks === 0 && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-3 flex-1">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-xs">
            <h4 className="text-sm font-semibold text-foreground">Nenhuma tarefa para hoje</h4>
            <p className="text-xs text-muted-foreground">
              Crie tarefas na agenda para vê-las aqui.
            </p>
          </div>
          <Button asChild size="sm" className="gap-1.5 text-xs h-8 font-medium">
            <Link to="/agenda?filter=hoje">
              Ir para a agenda
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* STATE 4: SUCCESS */}
      {!loading && !isError && totalTasks > 0 && (
        <div className="py-3 space-y-2 flex-1 animate-in fade-in duration-300">
          <div className="divide-y divide-border/30">
            {visibleTasks.map((task) => {
              const isConcluida = task.status === 'concluida'
              const isCancelada = task.status === 'cancelada'
              const isAgendada = task.status === 'agendada'

              // Time & overdue status
              const dueTime = task.start_time?.trim() || ''

              // Overdue check: if agendada and time is already past current time today
              let isOverdue = false
              if (isAgendada && dueTime) {
                const now = new Date()
                const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(
                  now.getMinutes(),
                ).padStart(2, '0')}`
                if (dueTime < currentHHmm) {
                  isOverdue = true
                }
              }

              return (
                <div
                  key={task.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm group"
                >
                  {/* Left: TaskBadge + Title + Client Name */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <TaskBadge type={task.task_type} notes={task.notes} />

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'font-medium text-xs sm:text-sm text-foreground truncate',
                          (isConcluida || isCancelada) && 'line-through text-muted-foreground',
                        )}
                        title={task.title}
                      >
                        {task.title}
                      </p>
                      {task.client_name && (
                        <p
                          className="text-[11px] text-muted-foreground truncate"
                          title={task.client_name}
                        >
                          {task.client_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Due time + Status icon */}
                  <div className="flex items-center gap-2 shrink-0">
                    {dueTime ? (
                      <span className="text-xs font-mono font-medium text-muted-foreground">
                        {dueTime}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60 italic">--:--</span>
                    )}

                    <div className="shrink-0 flex items-center">
                      {isOverdue ? (
                        <span title="Tarefa atrasada" aria-label="Tarefa atrasada">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        </span>
                      ) : isConcluida ? (
                        <span title="Tarefa concluída" aria-label="Tarefa concluída">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </span>
                      ) : (
                        <span title="Tarefa agendada" aria-label="Tarefa agendada">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* "Ver todas" link when more than 5 tasks */}
          {hasMoreThan5 && (
            <div className="pt-2 text-right">
              <Link
                to="/agenda?filter=hoje"
                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
              >
                Ver todas ({totalTasks})
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 3. PROGRESS BAR (Shown whenever totalTasks > 0 or loaded) */}
      {!loading && !isError && totalTasks > 0 && (
        <div className="pt-3 mt-1 border-t border-border/30">
          <div
            className="w-full h-[6px] rounded-full bg-[var(--muted)] overflow-hidden"
            role="progressbar"
            aria-valuenow={completionPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
            title={`${completionPercentage}% concluído (${completedTasks} de ${totalTasks})`}
          >
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all ease-out"
              style={{
                width: mounted ? `${completionPercentage}%` : '0%',
                transitionDuration: '400ms',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default TodayTasksWidget
