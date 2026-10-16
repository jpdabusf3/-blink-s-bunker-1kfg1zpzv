import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRightLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  transferirClienteDistribuidor,
  type ClienteDistribuidor,
  type Distribuidor,
} from '@/services/distribuidores-service'
import { useAuth } from '@/hooks/use-auth'

interface TransferirClienteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClienteDistribuidor | null
  distribuidorOrigem: Distribuidor
  distribuidoresDisponiveis: Distribuidor[]
  onSuccess: () => void
}

export function TransferirClienteModal({
  open,
  onOpenChange,
  cliente,
  distribuidorOrigem,
  distribuidoresDisponiveis,
  onSuccess,
}: TransferirClienteModalProps) {
  const { user } = useAuth()
  const [destinoId, setDestinoId] = useState('')
  const [saving, setSaving] = useState(false)

  const outrosDistribuidores = distribuidoresDisponiveis.filter(
    (d) => d.id !== distribuidorOrigem.id,
  )

  const handleTransfer = async () => {
    if (!cliente || !destinoId) {
      toast.error('Selecione o distribuidor de destino.')
      return
    }

    const destino = outrosDistribuidores.find((d) => d.id === destinoId)
    if (!destino) return

    setSaving(true)
    try {
      await transferirClienteDistribuidor(
        cliente,
        destino.id,
        distribuidorOrigem.nome,
        destino.nome,
        user,
      )
      toast.success(
        `Cliente '${cliente.nome_cliente}' transferido para a carteira da '${destino.nome}' com sucesso!`,
      )
      onSuccess()
      onOpenChange(false)
      setDestinoId('')
    } catch (err: any) {
      console.error('[TransferirClienteModal] Erro ao transferir cliente:', err)
      toast.error(err?.message || 'Erro ao transferir cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" /> Transferir Cliente de Carteira
          </DialogTitle>
          <DialogDescription>
            Transfira a gestão do cliente para outro player credenciado. A ação será registrada no
            histórico de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-xs space-y-1">
            <p>
              <strong className="text-muted-foreground">Cliente:</strong>{' '}
              <span className="font-semibold text-foreground">{cliente?.nome_cliente}</span>
            </p>
            <p>
              <strong className="text-muted-foreground">Localização:</strong>{' '}
              {cliente?.municipio ? `${cliente.municipio} - ` : ''}
              {cliente?.uf || 'Sem UF'}
            </p>
            <p>
              <strong className="text-muted-foreground">Distribuidor Atual:</strong>{' '}
              <span className="font-medium text-foreground">{distribuidorOrigem.nome}</span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Novo Distribuidor Destino *</Label>
            {outrosDistribuidores.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhum outro distribuidor cadastrado no sistema para receber a transferência.
              </p>
            ) : (
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o novo distribuidor..." />
                </SelectTrigger>
                <SelectContent>
                  {outrosDistribuidores.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome} {d.status === 'inativo' ? '(Inativo)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!destinoId || saving || outrosDistribuidores.length === 0}
            onClick={handleTransfer}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transferindo...
              </>
            ) : (
              'Confirmar Transferência'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
