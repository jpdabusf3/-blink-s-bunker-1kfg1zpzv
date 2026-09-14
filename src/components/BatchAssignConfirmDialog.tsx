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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Users, AlertTriangle, ArrowRight } from 'lucide-react'
import type { Factory } from '@/types'

interface BatchAssignConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedFactories: Factory[]
  newVendedorName: string | null
  applyVendedor: boolean
  newGestorName?: string | null
  applyGestor?: boolean
  onConfirm: () => Promise<void>
}

export function BatchAssignConfirmDialog({
  open,
  onOpenChange,
  selectedFactories,
  newVendedorName,
  applyVendedor,
  onConfirm,
}: BatchAssignConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Confirmar Atribuição em Lote
          </DialogTitle>
          <DialogDescription className="text-xs">
            Esta ação atualizará as atribuições de{' '}
            <strong className="text-foreground">{selectedFactories.length} cliente(s)</strong> de
            uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
            <div className="font-semibold text-foreground text-xs">Resumo das Alterações:</div>
            {applyVendedor && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Novo Vendedor:</span>
                <Badge
                  variant={newVendedorName ? 'default' : 'outline'}
                  className="font-medium text-xs"
                >
                  {newVendedorName || 'Nenhum / Desatribuído'}
                </Badge>
              </div>
            )}
            {!applyVendedor && (
              <p className="text-destructive text-xs">Nenhum campo selecionado para alteração.</p>
            )}
          </div>

          <div>
            <div className="text-[11px] text-muted-foreground mb-1">
              Clientes que serão atualizados ({selectedFactories.length}):
            </div>
            <ScrollArea className="max-h-40 rounded border bg-card p-2">
              <ul className="space-y-1">
                {selectedFactories.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between text-[11px] py-0.5 border-b border-border/50 last:border-0"
                  >
                    <span className="font-medium truncate max-w-[220px]" title={f.name}>
                      {f.name}
                    </span>
                    <span className="text-muted-foreground text-[10px] truncate">
                      {applyVendedor && (
                        <span>
                          vend: {f.vendedor_name || 'sem'}{' '}
                          <ArrowRight className="inline w-2.5 h-2.5" />
                        </span>
                      )}{' '}
                      {[f.city, f.state].filter(Boolean).join('/') || ''}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>

          <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              Apenas os campos de atribuição serão atualizados. Todos os demais dados (financeiro,
              contatos, notas, funil) serão preservados intactos. Um histórico de auditoria será
              gerado para cada cliente.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !applyVendedor}
            className="gap-1.5"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar e Atribuir ({selectedFactories.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
