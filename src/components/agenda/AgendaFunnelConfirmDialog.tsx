import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowRight } from 'lucide-react'
import { type AgendaTask, getNextFunnelStage, isLastFunnelStage } from '@/services/agenda-service'

interface AgendaFunnelConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: AgendaTask | null
  dealStage?: string | null
  onKeepStage: () => void | Promise<void>
  onMoveToNextStage: () => Promise<void>
  onCancelTask: () => Promise<void>
}

export function AgendaFunnelConfirmDialog({
  open,
  onOpenChange,
  task,
  dealStage,
  onKeepStage,
  onMoveToNextStage,
  onCancelTask,
}: AgendaFunnelConfirmDialogProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const currentStage = dealStage || task?.expand?.deal_id?.funnelStage || 'Lead'
  const nextStage = getNextFunnelStage(currentStage)
  const isFinal = isLastFunnelStage(currentStage) || !nextStage

  const handleKeep = async () => {
    setLoadingAction('keep')
    try {
      await onKeepStage()
      onOpenChange(false)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleMove = async () => {
    if (isFinal) return
    setLoadingAction('move')
    try {
      await onMoveToNextStage()
      onOpenChange(false)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleCancel = async () => {
    setLoadingAction('cancel')
    try {
      await onCancelTask()
      onOpenChange(false)
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar o negócio no funil?</DialogTitle>
          <DialogDescription>
            A tarefa foi concluída. Escolha como deseja atualizar a etapa do negócio vinculado no
            funil de vendas.
          </DialogDescription>
        </DialogHeader>

        {task && (
          <div className="space-y-3 py-2 text-xs">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tarefa:</span>
                <span className="font-semibold text-foreground truncate max-w-[220px]">
                  {task.title}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Negócio:</span>
                <span className="font-semibold text-foreground truncate max-w-[220px]">
                  {task.expand?.deal_id?.name || task.client_name || 'Negócio vinculado'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border/40">
                <span className="text-muted-foreground">Etapa atual:</span>
                <Badge variant="outline" className="font-medium">
                  {currentStage}
                </Badge>
              </div>
              {!isFinal && nextStage && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Próxima etapa:</span>
                  <div className="flex items-center gap-1 font-semibold text-primary">
                    <ArrowRight className="w-3 h-3" />
                    <span>{nextStage}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-col gap-2">
          {/* Opção 1: Manter etapa atual (padrão) */}
          <Button
            type="button"
            variant="default"
            className="w-full"
            disabled={loadingAction !== null}
            onClick={handleKeep}
          >
            {loadingAction === 'keep' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Manter etapa atual
          </Button>

          {/* Opção 2: Mover para a próxima etapa */}
          <div className="w-full space-y-1">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isFinal || loadingAction !== null}
              onClick={handleMove}
              title={isFinal ? 'Negócio já está na etapa final' : undefined}
            >
              {loadingAction === 'move' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mover para a próxima etapa
            </Button>
            {isFinal && (
              <p className="text-[11px] text-center text-muted-foreground">
                Negócio já está na etapa final
              </p>
            )}
          </div>

          {/* Opção 3: Cancelar tarefa (reverte status para agendada) */}
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            disabled={loadingAction !== null}
            onClick={handleCancel}
          >
            {loadingAction === 'cancel' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Cancelar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
