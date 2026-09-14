import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
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
import { getVendedoresGestao, type GestaoTecnica } from '@/services/gestao-tecnica'
import {
  createHistoricoVenda,
  updateHistoricoVenda,
  ESPECIE_OPTIONS,
  CANAL_VENDAS_OPTIONS,
  type HistoricoVenda,
} from '@/services/historico-vendas'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { useToast } from '@/hooks/use-toast'

interface VendaFormProps {
  onSubmit: () => void
  initialData?: HistoricoVenda
}

export function VendaForm({ onSubmit, initialData }: VendaFormProps) {
  const { toast } = useToast()
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    getVendedoresGestao()
      .then((v) => {
        setVendedores(v)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})
    const fd = new FormData(e.currentTarget)
    const payload = {
      data: fd.get('data') as string,
      cliente: fd.get('cliente') as string,
      especie: fd.get('especie') as string,
      gestor_tecnico_id: initialData?.gestor_tecnico_id || undefined,
      vendedor_id: (fd.get('vendedor_id') as string) || undefined,
      canal_vendas: (fd.get('canal_vendas') as string) || undefined,
      valor: Number(fd.get('valor')),
      observacoes: (fd.get('observacoes') as string) || undefined,
      origem: 'manual' as const,
      atualizado_em: new Date().toISOString(),
    }
    try {
      if (initialData) await updateHistoricoVenda(initialData.id, payload)
      else await createHistoricoVenda(payload)
      toast({
        title: 'Sucesso',
        description: initialData ? 'Venda atualizada!' : 'Venda registrada!',
      })
      onSubmit()
    } catch (err) {
      setErrors(extractFieldErrors(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data *</Label>
          <Input type="date" name="data" defaultValue={initialData?.data?.split('T')[0]} required />
          {errors.data && <p className="text-xs text-destructive">{errors.data}</p>}
        </div>
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Input name="cliente" defaultValue={initialData?.cliente} required />
          {errors.cliente && <p className="text-xs text-destructive">{errors.cliente}</p>}
        </div>
        <div className="space-y-2">
          <Label>Espécie *</Label>
          <Select name="especie" defaultValue={initialData?.especie || ''} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ESPECIE_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.especie && <p className="text-xs text-destructive">{errors.especie}</p>}
        </div>
        <div className="space-y-2">
          <Label>Canal de Vendas</Label>
          <Select name="canal_vendas" defaultValue={initialData?.canal_vendas || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CANAL_VENDAS_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Vendedor</Label>
          <Select name="vendedor_id" defaultValue={initialData?.vendedor_id || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Valor (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            name="valor"
            defaultValue={initialData?.valor}
            min={0.01}
            required
          />
          {errors.valor && <p className="text-xs text-destructive">{errors.valor}</p>}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Observações</Label>
          <Textarea name="observacoes" defaultValue={initialData?.observacoes} rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSubmit}>
          Cancelar
        </Button>
        <Button type="submit">{initialData ? 'Salvar' : 'Registrar Venda'}</Button>
      </div>
    </form>
  )
}
