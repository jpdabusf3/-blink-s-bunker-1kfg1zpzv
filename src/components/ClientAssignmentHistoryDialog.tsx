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
  History,
  Loader2,
  Search,
  ArrowRight,
  UserCheck,
  Shield,
  Filter,
  Calendar,
  Building2,
} from 'lucide-react'
import { getAssignmentAuditLogs } from '@/services/activity-logs'
import { formatDateTime } from '@/lib/utils'
import type { Factory, ActivityLog } from '@/types'

interface ClientAssignmentHistoryDialogProps {
  factory: Factory | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClientAssignmentHistoryDialog({
  factory,
  open,
  onOpenChange,
}: ClientAssignmentHistoryDialogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const loadLogs = useCallback(async () => {
    if (!factory) return
    setLoading(true)
    try {
      const data = await getAssignmentAuditLogs(factory.id)
      setLogs(data)
    } catch (err) {
      console.error('[ClientAssignmentHistoryDialog] erro ao carregar logs:', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => {
    if (open && factory) {
      loadLogs()
      setSearch('')
    }
  }, [open, factory, loadLogs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Prioritize assignment logs, but include others for context if relevant
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const actionMatch = log.action?.toLowerCase().includes(q)
      const detailsMatch = log.details?.toLowerCase().includes(q)
      const userMatch =
        log.expand?.user?.name?.toLowerCase().includes(q) ||
        log.expand?.user?.email?.toLowerCase().includes(q)
      const statusAntMatch = (log as any).status_anterior?.toLowerCase().includes(q)
      const statusNovoMatch = (log as any).status_novo?.toLowerCase().includes(q)
      return actionMatch || detailsMatch || userMatch || statusAntMatch || statusNovoMatch
    })
  }, [logs, search])

  // Identifica logs de atribuição especificamente
  const isAssignmentLog = (log: ActivityLog) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Atribuições — {factory?.name || 'Cliente'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Auditoria da carteira: registro cronológico de quem alterou o vendedor ou gestor técnico
            deste cliente e quando a alteração ocorreu.
          </DialogDescription>
        </DialogHeader>

        {factory && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs rounded-lg border bg-muted/40 p-3">
            <div>
              <span className="text-muted-foreground block text-[11px]">Cliente</span>
              <span className="font-semibold text-foreground truncate block">{factory.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Vendedor Atual</span>
              <span className="font-medium text-foreground">
                {factory.vendedor_name || 'Não atribuído'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Gestor Técnico Atual</span>
              <span className="font-medium text-foreground">
                {factory.gestor_tecnico_name || 'Não atribuído'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por vendedor, usuário ou detalhe..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredLogs.length} registro(s)
          </span>
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg space-y-1">
              <p>Nenhuma mudança de atribuição registrada ainda para este cliente.</p>
              <p className="text-xs text-muted-foreground/75">
                Novas alterações de vendedor ou gestor serão gravadas automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLogs.map((log) => {
                const isAssign = isAssignmentLog(log)
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

                    {/* Exibição clara de transição de / para se existir nos campos estruturados */}
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
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        id: {log.id}
                      </span>
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
