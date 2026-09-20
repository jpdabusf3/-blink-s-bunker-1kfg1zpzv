import { type AgendaTask, TASK_TYPE_LABELS } from '@/services/agenda-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Check,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  XCircle,
  Building2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgendaTaskCardProps {
  task: AgendaTask
  onClick: (task: AgendaTask) => void
  onToggleConcluida: (task: AgendaTask, e: React.MouseEvent) => void
  onCancelTask: (task: AgendaTask, e: React.MouseEvent) => void
  onDeleteTask: (task: AgendaTask, e: React.MouseEvent) => void
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  reuniao: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/40',
  visita: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40',
  evento: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/40',
  ligacao: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40',
  outro: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300/40',
}

export function AgendaTaskCard({
  task,
  onClick,
  onToggleConcluida,
  onCancelTask,
  onDeleteTask,
}: AgendaTaskCardProps) {
  const isConcluida = task.status === 'concluida'
  const isCancelada = task.status === 'cancelada'
  const isAgendada = task.status === 'agendada'

  // Overdue check: task_date is before today (YYYY-MM-DD) and status is still agendada
  const todayStr = new Date().toISOString().split('T')[0]
  const taskDateOnly = task.task_date ? task.task_date.split(' ')[0].split('T')[0] : ''
  const isOverdue = isAgendada && Boolean(taskDateOnly && taskDateOnly < todayStr)

  const clientDisplay = task.client_name || task.expand?.deal_id?.name || ''

  const hasTimes = Boolean(task.start_time || task.end_time)
  const timeDisplay = [task.start_time, task.end_time].filter(Boolean).join(' - ')

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
        'group relative flex flex-col gap-2 p-3 rounded-lg border bg-card text-card-foreground text-left shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20',
        isConcluida && 'opacity-60 bg-muted/40 border-muted-foreground/20',
        isCancelada && 'opacity-50 bg-muted/20 border-dashed border-muted-foreground/30',
        isOverdue && 'border-destructive/50 bg-destructive/5',
      )}
    >
      {/* Top row: Type badge + Overdue tag + Actions dropdown */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 font-medium capitalize',
              TYPE_BADGE_STYLES[task.task_type] || TYPE_BADGE_STYLES.outro,
            )}
          >
            {TASK_TYPE_LABELS[task.task_type] || task.task_type}
          </Badge>

          {isOverdue && (
            <Badge
              variant="destructive"
              className="text-[9px] px-1.5 py-0 font-semibold gap-1 tracking-tight"
            >
              <AlertTriangle className="w-2.5 h-2.5" />
              Atrasada
            </Badge>
          )}

          {isConcluida && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 font-medium text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 gap-0.5"
            >
              <Check className="w-2.5 h-2.5" />
              Concluída
            </Badge>
          )}

          {isCancelada && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 font-medium text-muted-foreground border-muted-foreground/30 bg-muted/30"
            >
              Cancelada
            </Badge>
          )}
        </div>

        {/* Actions Dropdown */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Quick complete button */}
          <Button
            type="button"
            size="icon"
            variant={isConcluida ? 'default' : 'ghost'}
            className={cn(
              'h-6 w-6 rounded-full transition-colors',
              isConcluida
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10',
            )}
            onClick={(e) => onToggleConcluida(task, e)}
            title={isConcluida ? 'Reabrir tarefa' : 'Marcar como concluída'}
          >
            <Check className="w-3.5 h-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onClick(task)}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuItem onClick={(e) => onToggleConcluida(task, e as any)}>
                <Check className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                {isConcluida ? 'Reabrir tarefa' : 'Marcar concluída'}
              </DropdownMenuItem>

              {!isCancelada && (
                <DropdownMenuItem onClick={(e) => onCancelTask(task, e as any)}>
                  <XCircle className="w-3.5 h-3.5 mr-2 text-amber-600" />
                  Cancelar tarefa
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={(e) => onDeleteTask(task, e as any)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <h4
        className={cn(
          'text-sm font-semibold leading-snug text-foreground line-clamp-2',
          isCancelada && 'line-through text-muted-foreground',
          isConcluida && 'text-muted-foreground',
        )}
      >
        {task.title}
      </h4>

      {/* Meta: Times and Client */}
      {(hasTimes || clientDisplay) && (
        <div className="space-y-1 text-xs text-muted-foreground pt-0.5">
          {hasTimes && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 shrink-0 text-muted-foreground/80" />
              <span className="font-mono text-[11px]">{timeDisplay}</span>
            </div>
          )}

          {clientDisplay && (
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="w-3 h-3 shrink-0 text-muted-foreground/80" />
              <span className="truncate">{clientDisplay}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes preview if present */}
      {task.notes && (
        <p className="text-[11px] text-muted-foreground/80 line-clamp-1 italic border-t border-border/40 pt-1 mt-0.5">
          {task.notes}
        </p>
      )}
    </div>
  )
}
