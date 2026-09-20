import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  User,
} from 'lucide-react'
import type { RecordSubscription } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { useUsers } from '@/hooks/use-users'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import {
  buildUnifiedVendedoresList,
  resolveVendedorIdentity,
  type UnifiedVendedorOption,
} from '@/lib/vendedorFilterHelper'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface WeeklyAgendaTaskItem {
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
  expand?: {
    user_id?: {
      id: string
      name: string
      email?: string
    }
    deal_id?: {
      id: string
      name: string
    }
  }
}

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

const MONTH_NAMES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const WEEKDAY_NAMES_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/**
 * Formata a faixa de datas no estilo "15 a 21 de setembro" ou "28 de agosto a 3 de setembro"
 */
function formatWeekRangeText(monday: Date, sunday: Date): string {
  const startDay = monday.getDate()
  const endDay = sunday.getDate()
  const startMonth = monday.getMonth()
  const endMonth = sunday.getMonth()

  if (startMonth === endMonth) {
    return `${startDay} a ${endDay} de ${MONTH_NAMES_PT[startMonth]}`
  }
  return `${startDay} de ${MONTH_NAMES_PT[startMonth]} a ${endDay} de ${MONTH_NAMES_PT[endMonth]}`
}

/**
 * Dot colors matching TaskBadge colors from agenda:
 * - VISITA TÉCNICA (visita, visita_tecnica): emerald-500
 * - VISITA COMERCIAL (evento, visita_comercial): blue-500
 * - LIGAÇÃO (ligacao): amber-500
 * - FOLLOW-UP (follow_up): violet-500
 * - REUNIÃO (reuniao): rose-500
 * - TAREFA INTERNA (outro, tarefa_interna): gray-400
 */
function getTaskDotClass(type: string, notes?: string): string {
  const norm = (type || 'outro').toLowerCase().trim()
  if (norm === 'visita' || norm === 'visita_tecnica') return 'bg-emerald-500'
  if (norm === 'evento' || norm === 'visita_comercial') return 'bg-blue-500'
  if (norm === 'ligacao') return 'bg-amber-500'
  if (
    norm === 'follow_up' ||
    norm === 'follow-up' ||
    norm === 'followup' ||
    (norm === 'outro' && notes && /follow[- ]?up/i.test(notes))
  ) {
    return 'bg-violet-500'
  }
  if (norm === 'reuniao') return 'bg-rose-500'
  return 'bg-gray-400 dark:bg-gray-500'
}

function getInitials(name?: string): string {
  if (!name) return 'VD'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function WeeklyAgendaCard() {
  const { toast } = useToast()
  const { users } = useUsers()
  const [gestaoMembers, setGestaoMembers] = useState<GestaoTecnica[]>([])

  // Week navigation state (Monday of the current selected week)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()))

  // Filter state
  const [selectedVendor, setSelectedVendor] = useState<string>('all')

  // Tasks state
  const [tasks, setTasks] = useState<WeeklyAgendaTaskItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isError, setIsError] = useState<boolean>(false)

  // Load gestao_tecnica members for unified vendor list
  useEffect(() => {
    getGestaoTecnica()
      .then(setGestaoMembers)
      .catch((err) => {
        console.warn('Erro ao carregar membros de gestao_tecnica:', err)
      })
  }, [])

  // Build unified vendor list: active vendors from gestao_tecnica + active users
  const vendorOptions = useMemo<UnifiedVendedorOption[]>(() => {
    return buildUnifiedVendedoresList(gestaoMembers, users)
  }, [gestaoMembers, users])

  // Map of userId to display name
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of users) {
      if (u.id && u.name) {
        map.set(u.id, u.name)
      }
    }
    for (const opt of vendorOptions) {
      for (const uid of opt.userIds) {
        if (!map.has(uid)) {
          map.set(uid, opt.label)
        }
      }
      if (opt.gestaoTecnicaId && !map.has(opt.gestaoTecnicaId)) {
        map.set(opt.gestaoTecnicaId, opt.label)
      }
    }
    return map
  }, [users, vendorOptions])

  // Current week days: Monday (0) to Sunday (6)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(currentMonday, i)
      const dateStr = formatDateISO(d)
      return {
        index: i,
        date: d,
        dateStr,
        dayOfMonth: d.getDate(),
        dayNameShort: WEEKDAY_NAMES_SHORT[i],
      }
    })
  }, [currentMonday])

  const sunday = weekDays[6].date
  const todayStr = formatDateISO(new Date())
  const weekRangeLabel = useMemo(
    () => formatWeekRangeText(currentMonday, sunday),
    [currentMonday, sunday],
  )

  const startIso = weekDays[0].dateStr
  const endIso = weekDays[6].dateStr

  // Ref to hold current filter/week boundaries for realtime callbacks
  const filterRef = useRef({
    selectedVendor,
    vendorOptions,
    startIso,
    endIso,
  })
  filterRef.current = {
    selectedVendor,
    vendorOptions,
    startIso,
    endIso,
  }

  // Load weekly tasks
  const loadTasks = useCallback(async () => {
    setLoading(true)
    setIsError(false)

    try {
      const filters: string[] = [
        `task_date >= "${startIso} 00:00:00" && task_date <= "${endIso} 23:59:59"`,
      ]

      // If a specific vendor is selected, filter by user_id
      if (selectedVendor !== 'all') {
        const identity = resolveVendedorIdentity(selectedVendor, vendorOptions)
        const userIds = Array.from(identity.ids)
        if (userIds.length > 0) {
          const userFilters = userIds.map((id) => `user_id = "${id}"`).join(' || ')
          filters.push(`(${userFilters})`)
        }
      }

      const records = await pb.collection('agenda_tasks').getFullList<WeeklyAgendaTaskItem>({
        filter: filters.join(' && '),
        sort: 'task_date,start_time,created',
        expand: 'user_id,deal_id',
        fields:
          'id,user_id,title,task_type,client_name,task_date,start_time,end_time,status,notes,expand.user_id.id,expand.user_id.name,expand.user_id.email,expand.deal_id.id,expand.deal_id.name',
      })

      setTasks(records)
    } catch (err) {
      console.error('Erro ao carregar agenda semanal:', err)
      setIsError(true)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar a agenda semanal.',
      })
    } finally {
      setLoading(false)
    }
  }, [startIso, endIso, selectedVendor, vendorOptions, toast])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Realtime subscription
  useEffect(() => {
    let unsubscribeFn: (() => Promise<void>) | undefined
    let isCancelled = false

    const handleRealtimeEvent = (e: RecordSubscription<WeeklyAgendaTaskItem>) => {
      const item = e.record
      const {
        selectedVendor: currVendor,
        vendorOptions: currOptions,
        startIso: currStart,
        endIso: currEnd,
      } = filterRef.current

      if (e.action === 'delete') {
        setTasks((prev) => prev.filter((t) => t.id !== item.id))
        return
      }

      const itemDateOnly = item.task_date ? item.task_date.split(' ')[0].split('T')[0] : ''
      const inRange = itemDateOnly >= currStart && itemDateOnly <= currEnd

      // Check vendor match if not 'all'
      let matchesVendor = true
      if (currVendor !== 'all') {
        const identity = resolveVendedorIdentity(currVendor, currOptions)
        matchesVendor = identity.ids.has(item.user_id)
      }

      if (!inRange || !matchesVendor) {
        // If updated outside our window/vendor, remove if present
        setTasks((prev) => prev.filter((t) => t.id !== item.id))
        return
      }

      // Add or update task
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === item.id)
        let next: WeeklyAgendaTaskItem[]
        if (exists) {
          next = prev.map((t) => (t.id === item.id ? item : t))
        } else {
          next = [...prev, item]
        }
        return next.sort((a, b) => {
          const dateCmp = (a.task_date || '').localeCompare(b.task_date || '')
          if (dateCmp !== 0) return dateCmp
          const timeA = a.start_time?.trim() || '99:99'
          const timeB = b.start_time?.trim() || '99:99'
          return timeA.localeCompare(timeB)
        })
      })
    }

    pb.collection<WeeklyAgendaTaskItem>('agenda_tasks')
      .subscribe('*', handleRealtimeEvent)
      .then((unsub) => {
        if (isCancelled) {
          unsub().catch(() => {})
        } else {
          unsubscribeFn = unsub
        }
      })
      .catch((err) => {
        console.error('Erro ao subscrever realtime da agenda semanal:', err)
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
  }, [toast])

  // Week navigation actions
  const handlePrevWeek = () => {
    setCurrentMonday((prev) => addDays(prev, -7))
  }

  const handleNextWeek = () => {
    setCurrentMonday((prev) => addDays(prev, 7))
  }

  // Derived metrics for "Todos os vendedores" view
  const totalTasksCount = tasks.length
  const completedTasksCount = tasks.filter((t) => t.status === 'concluida').length
  const pendingTasksCount = tasks.filter((t) => t.status !== 'concluida').length

  const completedPct = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0
  const pendingPct = totalTasksCount > 0 ? (pendingTasksCount / totalTasksCount) * 100 : 0

  // Top 5 vendors with pending tasks
  const top5PendingVendors = useMemo(() => {
    if (selectedVendor !== 'all') return []
    const pendingTasks = tasks.filter((t) => t.status !== 'concluida')
    const counts = new Map<string, number>()

    for (const t of pendingTasks) {
      const vendorName = t.expand?.user_id?.name || userNameMap.get(t.user_id) || 'Vendedor'
      counts.set(vendorName, (counts.get(vendorName) || 0) + 1)
    }

    return Array.from(counts.entries())
      .map(([name, pendingCount]) => ({ name, pendingCount }))
      .sort((a, b) => b.pendingCount - a.pendingCount)
      .slice(0, 5)
  }, [tasks, selectedVendor, userNameMap])

  // Tasks grouped by day for specific vendor grid
  const tasksByDay = useMemo(() => {
    const map: Record<string, WeeklyAgendaTaskItem[]> = {}
    for (const d of weekDays) {
      map[d.dateStr] = []
    }
    for (const t of tasks) {
      const dateOnly = t.task_date ? t.task_date.split(' ')[0].split('T')[0] : ''
      if (map[dateOnly]) {
        map[dateOnly].push(t)
      }
    }
    // Sort each day's tasks by start_time
    for (const d of weekDays) {
      map[d.dateStr].sort((a, b) => {
        const timeA = a.start_time?.trim() || '99:99'
        const timeB = b.start_time?.trim() || '99:99'
        return timeA.localeCompare(timeB)
      })
    }
    return map
  }, [tasks, weekDays])

  return (
    <div
      data-testid="weekly-agenda-card"
      className="col-span-1 lg:col-span-2 w-full rounded-[var(--radius)] bg-[var(--card)] p-[20px] shadow-sm border border-border text-card-foreground flex flex-col gap-4"
    >
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
        {/* Left: Icon, Title & Date range */}
        <div>
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-semibold text-lg text-foreground leading-tight">Agenda semanal</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{weekRangeLabel}</p>
        </div>

        {/* Center/Right: Week navigation arrows + Vendor filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Week navigation buttons */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevWeek}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Semana anterior"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextWeek}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Próxima semana"
              aria-label="Próxima semana"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Vendor Select Dropdown */}
          <div className="w-[200px] sm:w-[220px]">
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger className="h-9 text-xs focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center gap-2 truncate">
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Vendedor" />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {vendorOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 2. UX STATES */}

      {/* STATE 1: LOADING SKELETON */}
      {loading && (
        <div className="py-2 space-y-4">
          {selectedVendor === 'all' ? (
            /* Skeleton for "Todos os vendedores" */
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-border bg-muted/20 space-y-2"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-4 w-full rounded-full" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
          ) : (
            /* Skeleton for 7-column specific vendor grid */
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 animate-pulse">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-2 min-h-[160px]"
                >
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-5 w-8" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STATE 2: ERROR */}
      {!loading && isError && (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-sm">
            <p className="text-sm font-medium text-foreground">
              Não foi possível carregar a agenda semanal.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadTasks()}
            className="gap-1.5 text-xs h-8"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* STATE 3: EMPTY */}
      {!loading && !isError && totalTasksCount === 0 && (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="text-sm font-semibold text-foreground">
              Nenhuma ação agendada nesta semana
            </h4>
            <p className="text-xs text-muted-foreground">
              Agende tarefas na agenda para acompanhar o volume aqui.
            </p>
          </div>
          <Button asChild size="sm" className="gap-1.5 text-xs h-8 font-medium">
            <Link to="/agenda">
              Ir para a agenda
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {/* STATE 4: SUCCESS (fade-in 300ms) */}
      {!loading && !isError && totalTasksCount > 0 && (
        <div className="animate-in fade-in duration-300">
          {/* VIEW A: "Todos os vendedores" selecionado */}
          {selectedVendor === 'all' ? (
            <div className="space-y-5">
              {/* 3 Metric Cards in row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Total de ações */}
                <div className="p-3.5 rounded-lg border border-border bg-card shadow-xs flex flex-col justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Total de ações</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-bold text-3xl text-foreground">{totalTasksCount}</span>
                    <span className="text-xs text-muted-foreground">na semana</span>
                  </div>
                </div>

                {/* Realizadas */}
                <div className="p-3.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Realizadas
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-bold text-3xl text-emerald-600 dark:text-emerald-400">
                      {completedTasksCount}
                    </span>
                    <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-mono">
                      {completedPct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Pendentes */}
                <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Pendentes
                    </span>
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-bold text-3xl text-amber-600 dark:text-amber-400">
                      {pendingTasksCount}
                    </span>
                    <span className="text-xs text-amber-600/80 dark:text-amber-400/80 font-mono">
                      {pendingPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Stacked Horizontal Bar */}
              <div className="space-y-2">
                <div
                  className="w-full h-3 rounded-full bg-muted/60 overflow-hidden flex"
                  role="progressbar"
                  aria-label="Distribuição de tarefas concluídas e pendentes"
                >
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${completedPct}%` }}
                    title={`Concluídas: ${completedTasksCount} (${completedPct.toFixed(0)}%)`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${pendingPct}%` }}
                    title={`Pendentes: ${pendingTasksCount} (${pendingPct.toFixed(0)}%)`}
                  />
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Concluídas ({completedTasksCount})</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Pendentes ({pendingTasksCount})</span>
                    </span>
                  </div>
                  <Link
                    to="/agenda"
                    className="text-primary hover:underline inline-flex items-center gap-1 font-medium text-xs"
                  >
                    Ver agenda completa
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Top 5 Vendedores por tarefas pendentes */}
              {top5PendingVendors.length > 0 && (
                <div className="pt-2 border-t border-border/40 space-y-2.5">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Top vendedores com tarefas pendentes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {top5PendingVendors.map((v) => (
                      <div
                        key={v.name}
                        className="flex items-center justify-between gap-2 p-2 rounded-md border border-border/60 bg-muted/20"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Avatar className="w-7 h-7 shrink-0 text-[11px] font-bold border border-border">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(v.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-xs font-medium text-foreground truncate"
                            title={v.name}
                          >
                            {v.name}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-mono text-xs shrink-0 px-1.5 py-0.2"
                        >
                          {v.pendingCount}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* VIEW B: Vendedor específico selecionado -> Grade de 7 colunas (Seg a Dom) */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-2 items-start">
              {weekDays.map((day) => {
                const isToday = day.dateStr === todayStr
                const dayTasks = tasksByDay[day.dateStr] || []

                return (
                  <div
                    key={day.dateStr}
                    className={cn(
                      'flex flex-col min-h-[190px] rounded-lg border transition-all p-2 gap-2',
                      isToday
                        ? 'bg-[var(--accent)]/50 border-primary/50 shadow-xs ring-1 ring-primary/20'
                        : 'bg-card border-border/70 hover:border-border',
                    )}
                  >
                    {/* Column Header: Day name + Day of month */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={cn(
                            'text-xs font-semibold uppercase tracking-wider',
                            isToday ? 'text-primary font-bold' : 'text-foreground',
                          )}
                        >
                          {day.dayNameShort}
                        </span>
                        <span
                          className={cn(
                            'text-sm font-bold',
                            isToday ? 'text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {day.dayOfMonth}
                        </span>
                      </div>
                      {isToday && (
                        <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-primary text-primary-foreground leading-none">
                          Hoje
                        </span>
                      )}
                    </div>

                    {/* Column Content: tasks compact rows */}
                    <div className="flex-1 space-y-1.5">
                      {dayTasks.length === 0 ? (
                        <div className="h-20 flex items-center justify-center text-center">
                          <span className="text-muted-foreground/60 text-base font-mono select-none">
                            —
                          </span>
                        </div>
                      ) : (
                        dayTasks.map((task) => {
                          const dotClass = getTaskDotClass(task.task_type, task.notes)
                          const timeStr = task.start_time?.trim() || '--:--'
                          const isConcluida = task.status === 'concluida'

                          return (
                            <Link
                              key={task.id}
                              to={`/agenda?filter=${day.dateStr}&task=${task.id}`}
                              className={cn(
                                'group block p-1.5 rounded-md border border-border/40 bg-background/60 hover:bg-muted/60 transition-colors text-left',
                                isConcluida && 'opacity-65',
                              )}
                              title={`${task.title}${task.client_name ? ` (${task.client_name})` : ''}`}
                            >
                              {/* Top row: dot + time */}
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn('w-2 h-2 rounded-full shrink-0', dotClass)}
                                  aria-hidden="true"
                                />
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {timeStr}
                                </span>
                              </div>

                              {/* Title / Client truncated */}
                              <div className="mt-1 min-w-0">
                                <p
                                  className={cn(
                                    'text-[11px] font-medium leading-tight truncate text-foreground group-hover:text-primary transition-colors',
                                    isConcluida && 'line-through text-muted-foreground',
                                  )}
                                >
                                  {task.title}
                                </p>
                                {task.client_name && (
                                  <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                                    {task.client_name}
                                  </p>
                                )}
                              </div>
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WeeklyAgendaCard
