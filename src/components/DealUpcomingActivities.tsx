import { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Clock, CalendarDays } from 'lucide-react'
import { type AgendaTask, TASK_TYPE_LABELS, formatBRDateOnly } from '@/services/agenda-service'

interface DealUpcomingActivitiesProps {
  dealId: string
  className?: string
}

const TYPE_STYLES: Record<string, string> = {
  reuniao: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300/40',
  visita: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300/40',
  evento: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300/40',
  ligacao: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300/40',
  outro: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/40',
}

export function DealUpcomingActivities({ dealId, className = '' }: DealUpcomingActivitiesProps) {
  const [tasks, setTasks] = useState<AgendaTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    if (!dealId) {
      setTasks([])
      setLoading(false)
      return
    }

    setLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]

    // Tarefas futuras ou de hoje, com status agendada, ordenadas por data
    pb.collection('agenda_tasks')
      .getFullList<AgendaTask>({
        filter: `deal_id = "${dealId}" && task_date >= "${todayStr} 00:00:00" && status = "agendada"`,
        sort: 'task_date,start_time',
      })
      .then((records) => {
        if (isMounted) setTasks(records)
      })
      .catch((err) => {
        console.warn('Erro ao carregar próximas atividades do negócio:', err)
        if (isMounted) setTasks([])
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [dealId])

  return (
    <div className={`space-y-2 rounded-lg border bg-card/60 p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-primary" />
          Próximas atividades
        </h4>
        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
          {tasks.length}
        </Badge>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic py-1">
          Nenhuma atividade futura agendada para este negócio.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {tasks.map((task) => {
            const dateStr = formatBRDateOnly(task.task_date)
            const timeStr = [task.start_time, task.end_time].filter(Boolean).join(' - ')
            return (
              <div
                key={task.id}
                className="flex items-start justify-between gap-2 p-2 rounded-md border bg-background/70 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 capitalize ${TYPE_STYLES[task.task_type] || TYPE_STYLES.outro}`}
                    >
                      {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                    </Badge>
                    <span className="font-semibold text-foreground truncate">{task.title}</span>
                  </div>
                  {timeStr && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{timeStr}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0 pt-0.5">
                  <Calendar className="w-3 h-3 text-muted-foreground/70" />
                  <span>{dateStr}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
