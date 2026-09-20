import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgendaTask, AgendaTaskType } from '@/services/agenda-service'

export interface WeekDayItem {
  index: number
  date: Date
  dateStr: string
  dayOfMonth: number
  month: number
  dayName: string
  dayNameShort: string
  displayDate: string
}

export interface AgendaHeaderProps {
  title?: string
  weekRangeLabel: string
  weekDays: WeekDayItem[]
  todayStr: string
  selectedDayStr: string // 'todas' or 'YYYY-MM-DD'
  onSelectDay: (dayStr: string) => void
  vendorFilter: string
  onVendorFilterChange: (vendor: string) => void
  typeFilter: string
  onTypeFilterChange: (type: string) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  onNewTask: () => void
  tasks: AgendaTask[]
  tasksByDay: Record<string, AgendaTask[]>
}

const DISPLAY_TASK_TYPES: { value: string; label: string }[] = [
  { value: 'todas', label: 'Todos os tipos' },
  { value: 'visita', label: 'Visita Técnica' },
  { value: 'evento', label: 'Visita Comercial' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'outro', label: 'Tarefa Interna' },
]

export function AgendaHeader({
  title = 'Agenda',
  weekRangeLabel,
  weekDays,
  todayStr,
  selectedDayStr,
  onSelectDay,
  vendorFilter,
  onVendorFilterChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  onPrevWeek,
  onNextWeek,
  onToday,
  onNewTask,
  tasks,
  tasksByDay,
}: AgendaHeaderProps) {
  // Extract distinct vendor options from tasks
  const vendorOptions = useMemo(() => {
    const set = new Map<string, string>()
    for (const t of tasks) {
      const vendorName = (t as any).expand?.user_id?.name || (t as any).user_name
      if (vendorName) {
        set.set(vendorName, vendorName)
      }
    }
    return Array.from(set.values()).sort()
  }, [tasks])

  return (
    <div className="space-y-4">
      {/* Top Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize reuniões, visitas, ligações e compromissos da semana.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Week Navigation */}
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevWeek}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              title="Semana anterior"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToday}
              className="h-8 px-2.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring"
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextWeek}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              title="Próxima semana"
              aria-label="Próxima semana"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button
            onClick={onNewTask}
            className="gap-2 shadow-sm min-h-[44px] px-4 font-semibold focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="w-4 h-4" />
            Nova tarefa
          </Button>
        </div>
      </div>

      {/* Horizontal Filter Bar: Day Selector Chips + Vendor Dropdown + Type + Status */}
      <div className="flex flex-col gap-3 p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
        {/* Row of Day Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          <button
            type="button"
            onClick={() => onSelectDay('todas')}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center justify-center shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selectedDayStr === 'todas'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border',
            )}
          >
            Semana inteira ({weekRangeLabel})
          </button>

          {weekDays.map((day) => {
            const isSelected = selectedDayStr === day.dateStr
            const isToday = day.dateStr === todayStr
            const count = (tasksByDay[day.dateStr] || []).length

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => onSelectDay(day.dateStr)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap min-h-[44px] flex items-center gap-1.5 shrink-0 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : isToday
                      ? 'bg-transparent text-primary border-primary/50 hover:bg-primary/10'
                      : 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border',
                )}
              >
                <span>{day.dayNameShort}</span>
                <span className="font-normal opacity-90">{day.dayOfMonth}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Filters Row: Vendor Dropdown, Task Type, Status */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-border/60">
          {/* Vendor Dropdown */}
          <div className="flex-1 min-w-[180px] sm:max-w-xs">
            <Select value={vendorFilter} onValueChange={onVendorFilterChange}>
              <SelectTrigger className="min-h-[44px] text-xs focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center gap-2 truncate">
                  <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Vendedor" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os vendedores</SelectItem>
                {vendorOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Filter */}
          <div className="flex-1 min-w-[160px] sm:max-w-xs">
            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
              <SelectTrigger className="min-h-[44px] text-xs focus-visible:ring-2 focus-visible:ring-ring">
                <SelectValue placeholder="Tipo de tarefa" />
              </SelectTrigger>
              <SelectContent>
                {DISPLAY_TASK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="flex-1 min-w-[150px] sm:max-w-xs">
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="min-h-[44px] text-xs focus-visible:ring-2 focus-visible:ring-ring">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os status</SelectItem>
                <SelectItem value="agendada">Agendadas</SelectItem>
                <SelectItem value="concluida">Concluídas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
