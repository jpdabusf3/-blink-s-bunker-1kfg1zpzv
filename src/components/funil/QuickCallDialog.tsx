import { useState, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Phone, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { registerCallInteraction, type CallOutcome } from '@/services/client-interactions'
import type { Factory } from '@/types'

interface QuickCallDialogProps {
  client: Factory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (updatedClient: Factory) => void
}

export function QuickCallDialog({ client, open, onOpenChange, onSuccess }: QuickCallDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [summary, setSummary] = useState('')
  const [outcome, setOutcome] = useState<CallOutcome>('Interessado')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (open) {
      setSummary('')
      setOutcome('Interessado')
      setErrorMessage('')
    }
  }, [open, client])

  if (!client) return null

  const phone = client.telefone || client.contactPhone || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = summary.trim()
    if (trimmed.length < 3) {
      setErrorMessage('Escreva um resumo de pelo menos 3 caracteres.')
      return
    }
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await registerCallInteraction({
        clientId: client.id,
        clientName: client.name,
        summary: trimmed,
        outcome,
        userId: user?.id,
        origem: 'funil_atalhos',
      })

      const nowIso = new Date().toISOString()
      const updatedClient: Factory = {
        ...client,
        lastInteraction: nowIso,
      }

      toast({
        title: 'Ligação registrada',
        description: `Ligação com ${client.name} gravada com sucesso.`,
      })

      onSuccess?.(updatedClient)
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('[QuickCallDialog] Erro ao registrar ligação:', err)
      toast({
        title: 'Erro ao registrar ligação',
        description: 'Não foi possível salvar o registro de ligação.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Phone className="w-4 h-4 text-primary" />
            Registrar ligação rápida
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {client.name} {phone ? `• ${phone}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="call-outcome" className="text-xs font-medium">
              Resultado da ligação
            </Label>
            <Select value={outcome} onValueChange={(val) => setOutcome(val as CallOutcome)}>
              <SelectTrigger id="call-outcome" className="h-9 text-xs">
                <SelectValue placeholder="Selecione o resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Interessado" className="text-xs">
                  Interessado
                </SelectItem>
                <SelectItem value="Sem resposta" className="text-xs">
                  Sem resposta
                </SelectItem>
                <SelectItem value="Reagendou" className="text-xs">
                  Reagendou
                </SelectItem>
                <SelectItem value="Não interessou" className="text-xs">
                  Não interessou
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="call-summary" className="text-xs font-medium">
              Resumo da conversa
            </Label>
            <Textarea
              id="call-summary"
              rows={3}
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value)
                if (errorMessage) setErrorMessage('')
              }}
              placeholder="Ex: Alinhamos envio de proposta com volume de 10 toneladas..."
              className="text-xs resize-none"
              autoFocus
            />
            {errorMessage && (
              <p className="text-[11px] text-destructive font-medium">{errorMessage}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Salvar ligação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
