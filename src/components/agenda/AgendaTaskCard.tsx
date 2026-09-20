import { type AgendaTask } from '@/services/agenda-service'
import { TaskBadge } from '@/components/agenda/TaskBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Check,
  CheckCircle2,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  XCircle,
  AlertTriangle,
  Link as LinkIcon,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AgendaTaskCardProps {
  task: AgendaTask
  onClick: (task: AgendaTask) => void
  onToggleConcluida: (task: AgendaTask, e: React.MouseEvent) => void
  onCancelTask: (task: AgendaTask, e: React.MouseEvent) => void
  onDeleteTask: (task: AgendaTask, e: React.MouseEvent) => void
  vendorName?: string
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'V'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AgendaTaskCard({
  task,
  onClick,
  onToggleConcluida,
  onCancelTask,
  onDeleteTask,
  vendorName,
}: AgendaTaskCardProps) {
  const isConcluida = task.status === 'concluida'
  const isCancelada = task.status === 'cancelada'
  const isAgendada = task.status === 'agendada'

  // Date comparisons
  const todayStr = new Date().toISOString().split('T')[0]
  const taskDateOnly = task.task_date ? task.task_date.split(' ')[0].split('T')[0] : ''
  const isOverdue = isAgendada && Boolean(taskDateOnly && taskDateOnly < todayStr)
  const isToday = Boolean(taskDateOnly && taskDateOnly === todayStr)
  const isFuture = Boolean(taskDateOnly && taskDateOnly > todayStr)

  // Client display & city
  const clientName = task.client_name || task.expand?.deal_id?.name || ''
  const city = task.expand?.deal_id?.city
  const state = task.expand?.deal_id?.state
  const locationDisplay = city ? `${city}${state ? ` - ${state}` : ''}` : ''
  const clientLocationLabel = [clientName, locationDisplay].filter(Boolean).join(' • ')

  // Time display
  const hasTimes = Boolean(task.start_time || task.end_time)
  const timeDisplay = [task.start_time, task.end_time].filter(Boolean).join(' - ')

  // Vendor display
  const resolvedVendor =
    vendorName || (task as any).expand?.user_id?.name || (task as any).user_name || 'Vendedor'
  const initials = getInitials(resolvedVendor)

  // Border & background rules:
  // - Overdue tasks: left border 4px solid var(--destructive), background tinted red at 5 percent opacity.
  // - Completed tasks: card opacity 0.65, title with line-through, left border 4px solid var(--primary).
  // - Today tasks: left border 4px solid var(--primary).
  // - Future tasks: left border 4px solid var(--muted-foreground) at 40 percent opacity.
  // - Base: var(--card) with border var(--border) and radius var(--radius).
  let borderLeftStyle = 'border-l-[4px] border-l-border'
  let bgStyle = 'bg-card'
  let cardOpacity = ''

  if (isOverdue) {
    borderLeftStyle = 'border-l-[4px] border-l-[hsl(var(--destructive))]'
    bgStyle = 'bg-[hsl(var(--destructive)/0.05)]'
  } else if (isConcluida) {
    borderLeftStyle = 'border-l-[4px] border-l-[hsl(var(--primary))]'
    cardOpacity = 'opacity-[0.65]'
  } else if (isToday) {
    borderLeftStyle = 'border-l-[4px] border-l-[hsl(var(--primary))]'
  } else if (isFuture) {
    borderLeftStyle = 'border-l-[4px] border-l-[hsl(var(--muted-foreground)/0.4)]'
  }

  return (
    <div
      onClick={() => onClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(task)
        }
      }}
      className={cn(
        'group relative flex flex-col gap-2 p-4 rounded-[var(--radius)] border border-border text-card-foreground text-left shadow-sm transition-all duration-150 cursor-pointer hover:shadow-md hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
        bgStyle,
        borderLeftStyle,
        cardOpacity,
        isCancelada && 'opacity-50 border-dashed',
      )}
    >
      {/* Top-right subtle green check badge for completed cards */}
      {isConcluida && (
        <span
          className="absolute -top-2 -right-2 z-10 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white shadow-sm ring-2 ring-card"
          title="Tarefa concluída"
          aria-label="Tarefa concluída"
        >
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      )}

      {/* Row 1: TaskBadge left, due time right (text-sm font-medium, muted color) + card actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <TaskBadge type={task.task_type} notes={task.notes} />

          {isOverdue && (
            <Badge
              variant="destructive"
              className="text-[10px] px-2 py-0 font-semibold gap-1 uppercase tracking-tight"
            >
              <AlertTriangle className="w-3 h-3" />
              Atrasada
            </Badge>
          )}

          {Boolean(task.deal_id) && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 gap-1 text-primary bg-primary/10 border-primary/20"
              title="Tarefa conectada a um negócio no funil"
            >
              <LinkIcon className="w-2.5 h-2.5" />
              <span className="sr-only">Conectada ao funil</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {hasTimes && (
            <span className="text-sm font-medium text-muted-foreground font-mono">
              {timeDisplay}
            </span>
          )}

          {/* Quick complete button (min 44px hit target) */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'min-h-[44px] min-w-[44px] rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              isConcluida
                ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/15'
                : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10',
            )}
            onClick={(e) => onToggleConcluida(task, e)}
            title={isConcluida ? 'Reabrir tarefa' : 'Marcar como concluída'}
            aria-label={isConcluida ? 'Reabrir tarefa' : 'Marcar como concluída'}
          >
            <CheckCircle2
              className={cn(
                'w-4 h-4',
                isConcluida && 'text-emerald-600 fill-emerald-100 dark:fill-emerald-950',
              )}
            />
          </Button>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Opções da tarefa"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="min-h-[44px] cursor-pointer"
                onClick={() => onClick(task)}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuItem
                className="min-h-[44px] cursor-pointer"
                onClick={(e) => onToggleConcluida(task, e as any)}
              >
                <Check className="w-4 h-4 mr-2 text-emerald-600" />
                {isConcluida ? 'Reabrir tarefa' : 'Marcar concluída'}
              </DropdownMenuItem>

              {!isCancelada && (
                <DropdownMenuItem
                  className="min-h-[44px] cursor-pointer"
                  onClick={(e) => onCancelTask(task, e as any)}
                >
                  <XCircle className="w-4 h-4 mr-2 text-amber-600" />
                  Cancelar tarefa
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="min-h-[44px] cursor-pointer text-destructive focus:text-destructive"
                onClick={(e) => onDeleteTask(task, e as any)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Task title, font-semibold text-base, single line with ellipsis */}
      <h4
        className={cn(
          'text-base font-semibold leading-snug text-foreground truncate',
          isConcluida && 'line-through text-muted-foreground',
          isCancelada && 'line-through text-muted-foreground',
        )}
        title={task.title}
      >
        {task.title}
      </h4>

      {/* Row 3: Client name and city, text-sm muted, with a MapPin icon (14px) before the text */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-h-[20px]">
        <MapPin className="w-[14px] h-[14px] shrink-0 text-muted-foreground/80" />
        <span className="truncate" title={clientLocationLabel || 'Sem cliente associado'}>
          {clientLocationLabel || 'Sem cliente associado'}
        </span>
      </div>

      {/* Row 4: Vendor name with a small avatar circle 24px using initials, plus status icon at right */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <div className="flex items-center gap-2 truncate">
          <div
            className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 border border-primary/25"
            title={resolvedVendor}
          >
            {initials}
          </div>
          <span className="text-xs font-medium text-foreground/80 truncate">{resolvedVendor}</span>
        </div>

        {/* Status icon at right: Clock for pending (agendada), CheckCircle2 green for done (concluida), AlertTriangle red for overdue */}
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
}
