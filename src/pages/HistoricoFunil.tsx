import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PlusCircle,
  Pencil,
  Trash2,
  ArrowRightLeft,
  UserCheck,
  Activity,
  ClipboardList,
  Search,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { useFunnelActivityLog, type LogActionParams } from '@/hooks/use-funnel-activity-log'
import type { FunnelActionType, FunnelEntityType } from '@/services/funnel-activity'
import type { FunnelActivityLog } from '@/services/funnel-activity'

const ACTION_TYPE_OPTIONS: { value: FunnelActionType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'create', label: 'Criacao' },
  { value: 'update', label: 'Atualizacao' },
  { value: 'delete', label: 'Exclusao' },
  { value: 'move', label: 'Movimentacao' },
  { value: 'assign', label: 'Atribuicao' },
  { value: 'status_change', label: 'Alteracao de Status' },
]

const ENTITY_TYPE_OPTIONS: { value: FunnelEntityType | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'deal', label: 'Negocios' },
  { value: 'client', label: 'Clientes' },
  { value: 'action_plan', label: 'Planos de Acao' },
  { value: 'goal', label: 'Metas' },
  { value: 'team_member', label: 'Equipe' },
]

const ACTION_ICONS: Record<FunnelActionType, typeof PlusCircle> = {
  create: PlusCircle,
  update: Pencil,
  delete: Trash2,
  move: ArrowRightLeft,
  assign: UserCheck,
  status_change: Activity,
}

const ACTION_COLORS: Record<FunnelActionType, string> = {
  create: 'bg-primary/15 text-primary',
  update: 'bg-blue-500/15 text-blue-500',
  delete: 'bg-destructive/15 text-destructive',
  move: 'bg-amber-500/15 text-amber-500',
  assign: 'bg-purple-500/15 text-purple-500',
  status_change: 'bg-emerald-500/15 text-emerald-500',
}

const ENTITY_LINKS: Partial<Record<FunnelEntityType, string>> = {
  deal: '/funil',
  client: '/cadastro',
  action_plan: '/atividades',
  goal: '/metas',
  team_member: '/equipe',
  factory: '/cadastro',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <ClipboardList className="w-14 h-14 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground">Nenhuma atividade registrada</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        As ações realizadas no funil aparecerão aqui automaticamente.
      </p>
      <Button asChild variant="outline" className="mt-6 gap-2">
        <Link to="/funil">Voltar para o funil</Link>
      </Button>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <AlertTriangle className="w-14 h-14 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground">
        Nao foi possivel carregar o historico.
      </h3>
      <Button variant="outline" onClick={onRetry} className="mt-6 gap-2">
        <RefreshCw className="w-4 h-4" />
        Tentar novamente
      </Button>
    </div>
  )
}

interface TimelineItemProps {
  log: FunnelActivityLog
  isNew?: boolean
}

function TimelineItem({ log, isNew }: TimelineItemProps) {
  const Icon = ACTION_ICONS[log.action_type as FunnelActionType] || Activity
  const colorClass =
    ACTION_COLORS[log.action_type as FunnelActionType] || 'bg-muted text-muted-foreground'
  const userName = log.expand?.user?.name || log.expand?.user?.email || '—'
  const link = ENTITY_LINKS[log.entity_type as FunnelEntityType] || '/funil'

  return (
    <div
      className={`relative flex items-start gap-3 transition-colors ${
        isNew ? 'bg-primary/5 rounded-lg' : ''
      }`}
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0 pb-5 border-b border-border last:border-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{userName}</span>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDate(log.created)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{log.description}</p>
        {log.entity_name && (
          <div className="text-xs mt-1">
            <span className="text-muted-foreground">Entidade: </span>
            <Link to={link} className="text-primary hover:underline font-medium">
              {log.entity_name}
            </Link>
          </div>
        )}
        {log.old_value && log.new_value && (
          <div className="text-xs mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground">Anterior:</span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{log.old_value}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-muted-foreground">Novo:</span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">{log.new_value}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function HistoricoFunil() {
  const { data, loading, error, hasMore, loadMore, fetchActivity, subscribeToChanges } =
    useFunnelActivityLog()
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())

  // Filters state — default: last 30 days
  const [dateStart, setDateStart] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateEnd, setDateEnd] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [actionType, setActionType] = useState<FunnelActionType | 'all'>('all')
  const [entityType, setEntityType] = useState<FunnelEntityType | 'all'>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search, 300)

  const filters = useMemo(
    () => ({
      dateStart,
      dateEnd,
      action_type: actionType,
      entity_type: entityType,
      search: debouncedSearch,
    }),
    [dateStart, dateEnd, actionType, entityType, debouncedSearch],
  )

  const runFetch = useCallback(
    (f = filters) => {
      fetchActivity(f, 1)
    },
    [fetchActivity, filters],
  )

  // Reload when filters change
  useEffect(() => {
    fetchActivity(filters, 1)
  }, [filters, fetchActivity])

  // Realtime subscription
  useEffect(() => {
    const unsubscribe = subscribeToChanges((record) => {
      // Only insert at top if it matches current filters loosely (always, since
      // realtime INSERT is the signal). We re-fetch to keep consistency.
      setHighlightIds((prev) => {
        const n = new Set(prev)
        n.add(record.id)
        return n
      })
      fetchActivity(filters, 1)
      // Clear highlight after 3s
      setTimeout(() => {
        setHighlightIds((prev) => {
          const n = new Set(prev)
          n.delete(record.id)
          return n
        })
      }, 3000)
    })
    return unsubscribe
  }, [subscribeToChanges, fetchActivity, filters])

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Atividades</h1>
        <p className="text-muted-foreground text-sm">Acompanhe todas as ações no funil de vendas</p>
      </div>

      {/* Filters bar */}
      <Card className="p-3 shadow-subtle">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="h-9 w-[150px]"
              aria-label="Data inicial"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <Input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="h-9 w-[150px]"
              aria-label="Data final"
            />
          </div>
          <Select
            value={actionType}
            onValueChange={(v) => setActionType(v as FunnelActionType | 'all')}
          >
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={entityType}
            onValueChange={(v) => setEntityType(v as FunnelEntityType | 'all')}
          >
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="Tipo de entidade" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline content */}
      <Card className="p-5 shadow-subtle flex-1">
        {loading && data.length === 0 ? (
          <TimelineSkeleton />
        ) : error ? (
          <ErrorState onRetry={() => runFetch()} />
        ) : data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-0 animate-fade-in">
            {data.map((log) => (
              <TimelineItem key={log.id} log={log} isNew={highlightIds.has(log.id)} />
            ))}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={loadMore} disabled={loading}>
                  {loading ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// Re-export param type for callers integrating logAction.
export type { LogActionParams }
// (rebuilt chunk for /historico-funil route)
