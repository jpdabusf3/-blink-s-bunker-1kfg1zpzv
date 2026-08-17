import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { formatDateTime } from '@/lib/utils'
import {
  getClientHistory,
  addClientAction,
  generateAndStoreClientWordReport,
  type ActivityLogEntry,
} from '@/services/client-reports'
import { FileText, Plus, Loader2, History, ArrowRight } from 'lucide-react'
import type { Factory } from '@/types'
import { getReportTemplatePreference } from '@/services/report-template-preferences'
import { REPORT_TEMPLATE_LABEL } from '@/lib/reportTemplates'
import { PlanoAcaoPanel } from '@/components/PlanoAcaoPanel'

interface ClientHistoryDialogProps {
  factory: Factory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** origin label stored on each new action ("funil" | "funil_vendas") */
  origin?: string
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  status: { label: 'Mudança de Status', color: 'bg-blue-100 text-blue-700' },
  acao: { label: 'Ação', color: 'bg-emerald-100 text-emerald-700' },
  nota: { label: 'Nota', color: 'bg-amber-100 text-amber-700' },
  proximo_passo: { label: 'Próximo Passo', color: 'bg-purple-100 text-purple-700' },
  outro: { label: 'Outro', color: 'bg-muted text-muted-foreground' },
}

export function ClientHistoryDialog({
  factory,
  open,
  onOpenChange,
  origin = 'funil',
}: ClientHistoryDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newAction, setNewAction] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!factory) return
    setLoading(true)
    try {
      const data = await getClientHistory(factory.id)
      setLogs(data)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => {
    if (open && factory) {
      loadHistory()
      setShowForm(false)
      setNewAction('')
      setNextStep('')
    }
  }, [open, factory, loadHistory])

  const handleSaveAction = async () => {
    if (!factory || !newAction.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Descreva a ação antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await addClientAction({
        action: newAction.trim(),
        proximo_passo: nextStep.trim() || undefined,
        tipo: 'acao',
        origem: origin,
        clientId: factory.id,
      })
      toast({
        title: 'Ação registrada',
        description: 'A nova ação foi adicionada ao histórico do cliente.',
      })
      setNewAction('')
      setNextStep('')
      setShowForm(false)
      await loadHistory()
    } catch {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível registrar a ação.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateWord = async () => {
    if (!factory) return
    setGenerating(true)
    try {
      const modeloKey = await getReportTemplatePreference()
      await generateAndStoreClientWordReport(factory.id, factory.name, {
        titulo: `Relatório de Histórico — ${factory.name}`,
        modelo: modeloKey,
        solicitante: user?.name || user?.email || '',
      })
      toast({
        title: 'Relatório Word gerado',
        description: `Modelo ${REPORT_TEMPLATE_LABEL[modeloKey]}. O arquivo .docx foi baixado e também salvo na aba de Relatórios para acesso posterior.`,
      })
    } catch {
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o arquivo Word.',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  const userName = (log: ActivityLogEntry) =>
    log.expand?.user?.name || log.expand?.user?.email || '—'

  const tipoInfo = (tipo?: string) => TIPO_LABELS[tipo || 'outro'] || TIPO_LABELS.outro

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Ações — {factory?.name || 'Cliente'}
          </DialogTitle>
          <DialogDescription>
            Todo o histórico de ações, mudanças de status e próximos passos registrados para este
            cliente.
          </DialogDescription>
        </DialogHeader>

        {factory && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs rounded-lg border bg-muted/40 p-3">
            <div>
              <span className="text-muted-foreground">Cidade:</span>{' '}
              <span className="font-medium">{factory.city || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Estado:</span>{' '}
              <span className="font-medium">{factory.state || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Espécie:</span>{' '}
              <span className="font-medium">{factory.animalSpecies || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Funil:</span>{' '}
              <span className="font-medium">
                {factory.status_funil || factory.funnelStage || '—'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={showForm ? 'secondary' : 'default'}
            onClick={() => setShowForm((v) => !v)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" /> Nova Ação
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateWord}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            Gerar Relatório Word
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {logs.length} ação(ões) registrada(s)
          </span>
        </div>

        {showForm && (
          <div className="rounded-lg border bg-card p-3 space-y-3 animate-fade-in">
            <div className="space-y-1">
              <Label htmlFor="new-action">Ação realizada *</Label>
              <Textarea
                id="new-action"
                rows={3}
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                placeholder="Descreva a ação realizada com o cliente..."
                disabled={saving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="next-step">Próximo passo (opcional)</Label>
              <Input
                id="next-step"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="Ex: Agendar visita para próxima semana"
                disabled={saving}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setNewAction('')
                  setNextStep('')
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSaveAction} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Ação'}
              </Button>
            </div>
            {user && (
              <p className="text-[10px] text-muted-foreground">
                Registrando como: {user.name || user.email}
              </p>
            )}
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 max-h-[45vh] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed rounded-lg">
              Nenhuma ação registrada para este cliente ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const info = tipoInfo(log.tipo)
                const isStatus = log.tipo === 'status' || (log.status_anterior && log.status_novo)
                return (
                  <div key={log.id} className="rounded-lg border bg-card p-3 text-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={`text-[10px] ${info.color}`}>
                          {info.label}
                        </Badge>
                        <span className="font-semibold">{log.action}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(log.created)}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {log.details}
                      </p>
                    )}
                    {log.proximo_passo && (
                      <div className="text-xs flex items-start gap-1 text-primary">
                        <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>
                          <span className="font-semibold">Próximo passo:</span> {log.proximo_passo}
                        </span>
                      </div>
                    )}
                    {isStatus && (log.status_anterior || log.status_novo) && (
                      <div className="text-xs flex items-center gap-1">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" className="text-[10px]">
                          {log.status_anterior || '—'}
                        </Badge>
                        <ArrowRight className="w-3 h-3" />
                        <Badge variant="outline" className="text-[10px]">
                          {log.status_novo || '—'}
                        </Badge>
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground pt-1 border-t">
                      Responsável: <span className="font-medium">{userName(log)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {factory && (
          <div className="border-t pt-3">
            <PlanoAcaoPanel clienteId={factory.id} />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
