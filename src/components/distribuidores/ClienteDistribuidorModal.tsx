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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { BLINK_UF_LIST } from '@/constants/blinkProducts'
import {
  createClienteDistribuidor,
  type ClienteDistribuidor,
} from '@/services/distribuidores-service'
import { useAuth } from '@/hooks/use-auth'

interface ClienteDistribuidorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  distribuidorId: string
  distribuidorNome: string
  onSuccess: (cliente: ClienteDistribuidor) => void
}

export function ClienteDistribuidorModal({
  open,
  onOpenChange,
  distribuidorId,
  distribuidorNome,
  onSuccess,
}: ClienteDistribuidorModalProps) {
  const { user } = useAuth()

  const [nome, setNome] = useState('')
  const [uf, setUf] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [status, setStatus] = useState('ativo')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) {
      toast.error('Informe o nome da fazenda, indústria ou cliente.')
      return
    }

    setSaving(true)
    try {
      const res = await createClienteDistribuidor(
        {
          distribuidor_id: distribuidorId,
          nome_cliente: nome.trim().toUpperCase(),
          uf: uf || '',
          municipio: municipio.trim(),
          status,
          observacoes: observacoes.trim(),
        },
        distribuidorNome,
        user,
      )

      toast.success('Cliente incluído na carteira')
      onSuccess(res)
      onOpenChange(false)
      setNome('')
      setUf('')
      setMunicipio('')
      setStatus('ativo')
      setObservacoes('')
    } catch (err: any) {
      console.error('[ClienteDistribuidorModal] Erro ao incluir cliente:', err)
      toast.error(err?.message || 'Erro ao incluir cliente na carteira.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Incluir Cliente na Carteira</DialogTitle>
          <DialogDescription>
            Vincular cliente à carteira da{' '}
            <strong className="text-foreground">{distribuidorNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="nomeCliente" className="text-xs font-semibold">
              Razão Social / Nome do Cliente *
            </Label>
            <Input
              id="nomeCliente"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: TOPAGRO NUTRIÇÃO ANIMAL"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ufCliente" className="text-xs font-semibold">
                Estado (UF)
              </Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger id="ufCliente">
                  <SelectValue placeholder="Selecione UF" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {BLINK_UF_LIST.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="municipioCliente" className="text-xs font-semibold">
                Município
              </Label>
              <Input
                id="municipioCliente"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="Ex: Rio Verde"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="statusCliente" className="text-xs font-semibold">
              Status Comercial
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="statusCliente">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="prospeccao">Prospecção</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obsCliente" className="text-xs font-semibold">
              Observações
            </Label>
            <Textarea
              id="obsCliente"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações sobre a definição Blink ou produtos demandados..."
            />
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
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                'Incluir Cliente'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
