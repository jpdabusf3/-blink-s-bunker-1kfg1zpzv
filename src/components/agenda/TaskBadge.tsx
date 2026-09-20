import { cn } from '@/lib/utils'
import type { AgendaTaskType } from '@/services/agenda-service'

export type DisplayTaskType =
  | AgendaTaskType
  | 'follow_up'
  | 'visita_tecnica'
  | 'visita_comercial'
  | 'tarefa_interna'

interface TaskBadgeProps {
  type: string
  notes?: string
  className?: string
}

interface BadgeConfig {
  label: string
  // Light mode: solid tints, Dark mode: 900 color at 30% with 300 text
  className: string
}

// Color configuration per requirements:
// VISITA TECNICA: bg emerald-100, text emerald-800, dark: bg-emerald-900/30 text-emerald-300
// VISITA COMERCIAL: bg blue-100, text blue-800, dark: bg-blue-900/30 text-blue-300
// LIGACAO: bg amber-100, text amber-800, dark: bg-amber-900/30 text-amber-300
// FOLLOW-UP: bg violet-100, text violet-800, dark: bg-violet-900/30 text-violet-300
// REUNIAO: bg rose-100, text rose-800, dark: bg-rose-900/30 text-rose-300
// TAREFA INTERNA: bg gray-200, text gray-700, dark: bg-gray-900/30 text-gray-300
const BADGE_CONFIGS: Record<string, BadgeConfig> = {
  reuniao: {
    label: 'REUNIÃO',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  },
  visita: {
    label: 'VISITA TÉCNICA',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  visita_tecnica: {
    label: 'VISITA TÉCNICA',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  evento: {
    label: 'VISITA COMERCIAL',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  visita_comercial: {
    label: 'VISITA COMERCIAL',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  ligacao: {
    label: 'LIGAÇÃO',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  follow_up: {
    label: 'FOLLOW-UP',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  },
  outro: {
    label: 'TAREFA INTERNA',
    className: 'bg-gray-200 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  },
  tarefa_interna: {
    label: 'TAREFA INTERNA',
    className: 'bg-gray-200 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  },
}

export function TaskBadge({ type, notes, className }: TaskBadgeProps) {
  // If task_type is 'outro' or title/notes mention follow-up, display refinement can resolve to follow_up
  const normalizedType = (type || 'outro').toLowerCase().trim()
  let configKey = normalizedType

  // Check if it's follow-up either by raw value or display hint
  if (
    normalizedType === 'follow-up' ||
    normalizedType === 'followup' ||
    normalizedType === 'follow_up'
  ) {
    configKey = 'follow_up'
  } else if (normalizedType === 'outro' && notes && /follow[- ]?up/i.test(notes)) {
    configKey = 'follow_up'
  }

  const config = BADGE_CONFIGS[configKey] || BADGE_CONFIGS.outro

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-xs font-semibold px-2.5 py-0.5 uppercase tracking-wide shrink-0 whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
