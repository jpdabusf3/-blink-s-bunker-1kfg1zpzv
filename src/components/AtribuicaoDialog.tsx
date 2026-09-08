import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Loader2, UserCheck } from 'lucide-react'
import type { Factory } from '@/types'
import type { GestaoTecnica } from '@/services/gestao-tecnica'

interface AtribuicaoDialogProps {
  factory: Factory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  members: GestaoTecnica[]
  onSave: (
    factoryId: string,
    assignments: {
      vendedor_id: string | null
      vendedor_name: string | null
      gestor_tecnico_id: string | null
      gestor_tecnico_name: string | null
    },
  ) => Promise<void>
}

function formatRole(funcao?: string) {
  if (!funcao) return 'membro'
  switch (funcao) {
    case 'vendedor':
      return 'vendedor'
    case 'gestor_tecnico':
      return 'gestor técnico'
    case 'gestor_comercial':
      return 'gestor comercial'
    case 'gestor_especie':
      return 'gestor de espécie'
    case 'diretor':
      return 'diretor'
    case 'ceo':
      return 'CEO'
    default:
      return funcao.replace(/_/g, ' ')
  }
}

export function AtribuicaoDialog({
  factory,
  open,
  onOpenChange,
  members,
  onSave,
}: AtribuicaoDialogProps) {
  const [vendedorId, setVendedorId] = useState<string>('none')
  const [gestorId, setGestorId] = useState<string>('none')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (factory) {
      setVendedorId(factory.vendedor_id || 'none')
      setGestorId(factory.gestor_tecnico_id || 'none')
    }
  }, [factory, open])

  if (!factory) return null

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const vendMember = members.find((m) => m.id === vendedorId)
      const gestMember = members.find((m) => m.id === gestorId)

      await onSave(factory.id, {
        vendedor_id: vendedorId === 'none' ? null : vendedorId,
        vendedor_name: vendedorId === 'none' ? null : vendMember?.nome || null,
        gestor_tecnico_id: gestorId === 'none' ? null : gestorId,
        gestor_tecnico_name: gestorId === 'none' ? null : gestMember?.nome || null,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Editar Atribuições
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cliente: <span className="font-semibold text-foreground">{factory.name}</span>
            {factory.city ? ` (${factory.city}/${factory.state || ''})` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Vendedor Responsável</Label>
            <Select value={vendedorId} onValueChange={setVendedorId} disabled={saving}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o vendedor" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} — <span className="text-muted-foreground">{formatRole(m.funcao)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Gestor Técnico</Label>
            <Select value={gestorId} onValueChange={setGestorId} disabled={saving}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o gestor técnico" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} — <span className="text-muted-foreground">{formatRole(m.funcao)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Atribuições
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
