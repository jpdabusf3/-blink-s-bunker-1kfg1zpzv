import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ShieldCheck,
  Loader2,
  Search,
  ArrowRight,
  UserCheck,
  Calendar,
  Building2,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react'
import { getAssignmentAuditLogs } from '@/services/activity-logs'
import { formatDateTime } from '@/lib/utils'
import type { ActivityLog } from '@/types'

interface AssignmentAuditGlobalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignmentAuditGlobalDialog({
  open,
  onOpenChange,
}: AssignmentAuditGlobalDialogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [onlyAssignments, setOnlyAssignments] = useState(true)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAssignmentAuditLogs()
      setLogs(data)
    } catch (err) {
      console.error('[AssignmentAuditGlobalDialog] erro ao carregar:', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadLogs()
      setSearch('')
    }
  }, [open, loadLogs])

  const isAssignment = (log: ActivityLog) => {
    const act = (log.action || '').toLowerCase()
    const det = (log.details || '').toLowerCase()
    const tip = ((log as any).tipo || '').toLowerCase()
    return (
      tip === 'atribuicao' ||
      act.includes('atribui') ||
      act.includes('vendedor') ||
      act.includes('gestor') ||
      det.includes('vendedor') ||
      det.includes('gestor')
    )
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (onlyAssignments && !isAssignment(log)) {
        return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const act = log.action?.toLowerCase().includes(q)
      const det = log.details?.toLowerCase().includes(q)
      const user =
        log.expand?.user?.name?.toLowerCase().includes(q) ||
        log.expand?.user?.email?.toLowerCase().includes(q)
      const stAnt = (log as any).status_anterior?.toLowerCase().includes(q)
      const stNov = (log as any).status_novo?.toLowerCase().includes(q)
      return act || det || user || stAnt || stNov
    })
  }, [logs, search, onlyAssignments])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Auditoria da Carteira — Histórico Geral de Atribuições
          </DialogTitle>
          <DialogDescription className="text-xs">
            Acompanhe todas as transferências de clientes, rebalanceamentos em lote e alterações de
            vendedores e gestores técnicos realizadas na equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, vendedor, usuário..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={onlyAssignments ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setOnlyAssignments((v) => !v)}
              className="h-8 text-xs"
            >
              {onlyAssignments ? 'Somente Atribuições' : 'Todos os eventos'}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={loadLogs}
              disabled={loading}
              title="Recarregar"
              className="h-8 w-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center justify-between">
          <span>{filteredLogs.length} registro(s) listado(s)</span>
          <span className="text-[11px] italic">Ordenado por data mais recente</span>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[55vh] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg space-y-1">
              <p>Nenhum registro de atribuição encontrado.</p>
              <p className="text-xs text-muted-foreground/70">
                Altere vendedores na tabela para começar a registrar o histórico.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const isAssign = isAssignment(log)
                const userName = log.expand?.user?.name || log.expand?.user?.email || 'Sistema'
                const statusAnt = (log as any).status_anterior
                const statusNovo = (log as any).status_novo
                const origem = (log as any).origem

                return (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-3 text-xs space-y-2 transition-colors ${
                      isAssign ? 'bg-card border-primary/20' : 'bg-muted/20 border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isAssign ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 font-medium"
                          >
                            <UserCheck className="w-3 h-3" />
                            Atribuição
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Registro
                          </Badge>
                        )}
                        <span className="font-semibold text-foreground">{log.action}</span>
                        {origem && (
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase tracking-wider text-muted-foreground"
                          >
                            {origem}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(log.created)}
                      </span>
                    </div>

                    {(statusAnt || statusNovo) && (
                      <div className="flex items-center gap-2 p-2 rounded bg-muted/40 border text-xs">
                        <span className="text-muted-foreground">De:</span>
                        <Badge variant="outline" className="text-xs font-normal">
                          {statusAnt || 'Não atribuído'}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">Para:</span>
                        <Badge
                          variant="secondary"
                          className="text-xs font-medium bg-primary/10 text-primary"
                        >
                          {statusNovo || 'Não atribuído'}
                        </Badge>
                      </div>
                    )}

                    {log.details && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {log.details}
                      </p>
                    )}

                    <div className="text-[11px] text-muted-foreground pt-1.5 border-t flex items-center justify-between">
                      <span>
                        Alterado por:{' '}
                        <span className="font-medium text-foreground">{userName}</span>
                      </span>
                      {log.recordId && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono">
                          cliente: {log.recordId}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
