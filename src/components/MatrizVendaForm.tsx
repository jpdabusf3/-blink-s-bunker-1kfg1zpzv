import { useState, useEffect, type FormEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import { createMatrizVenda, updateMatrizVenda, type MatrizVenda } from '@/services/matriz-vendas'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { useToast } from '@/hooks/use-toast'

const CARTEIRAS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']
const MESES = ['janeiro', 'fevereiro', 'maro', 'abril', 'maio', 'junho', 'julho', 'agosto']

interface MatrizVendaFormProps {
  onSubmit: () => void
  initialData?: MatrizVenda
}

export function MatrizVendaForm({ onSubmit, initialData }: MatrizVendaFormProps) {
  const { toast } = useToast()
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    Promise.all([getGestoresTecnicos(), getVendedoresGestao()])
      .then(([g, v]) => {
        setGestores(g)
        setVendedores(v)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})
    const fd = new FormData(e.currentTarget)
    const payload = {
      pais: (fd.get('pais') as string) || '',
      carteira: (fd.get('carteira') as string) || '',
      grupo_cliente: (fd.get('grupo_cliente') as string) || '',
      razao_social: (fd.get('razao_social') as string) || '',
      mes: (fd.get('mes') as string) || '',
      valor: Number(fd.get('valor')) || 0,
      gestor_tecnico_id: (fd.get('gestor_tecnico_id') as string) || undefined,
      vendedor_id: (fd.get('vendedor_id') as string) || undefined,
      atualizado_em: new Date().toISOString(),
    }
    try {
      if (initialData) await updateMatrizVenda(initialData.id, payload)
      else await createMatrizVenda(payload)
      toast({
        title: 'Sucesso',
        description: initialData ? 'Registro atualizado!' : 'Registro criado!',
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
          <Label>País</Label>
          <Input name="pais" defaultValue={initialData?.pais} />
          {errors.pais && <p className="text-xs text-destructive">{errors.pais}</p>}
        </div>
        <div className="space-y-2">
          <Label>Carteira</Label>
          <Select name="carteira" defaultValue={initialData?.carteira || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CARTEIRAS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.carteira && <p className="text-xs text-destructive">{errors.carteira}</p>}
        </div>
        <div className="space-y-2">
          <Label>Grupo Cliente</Label>
          <Input name="grupo_cliente" defaultValue={initialData?.grupo_cliente} />
        </div>
        <div className="space-y-2">
          <Label>Razão Social</Label>
          <Input name="razao_social" defaultValue={initialData?.razao_social} />
        </div>
        <div className="space-y-2">
          <Label>Mês</Label>
          <Select name="mes" defaultValue={initialData?.mes || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.mes && <p className="text-xs text-destructive">{errors.mes}</p>}
        </div>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" name="valor" defaultValue={initialData?.valor} min={0} />
          {errors.valor && <p className="text-xs text-destructive">{errors.valor}</p>}
        </div>
        <div className="space-y-2">
          <Label>Gestor Técnico</Label>
          <Select name="gestor_tecnico_id" defaultValue={initialData?.gestor_tecnico_id || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {gestores.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.gestor_tecnico_id && (
            <p className="text-xs text-destructive">{errors.gestor_tecnico_id}</p>
          )}
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
          {errors.vendedor_id && <p className="text-xs text-destructive">{errors.vendedor_id}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSubmit}>
          Cancelar
        </Button>
        <Button type="submit">{initialData ? 'Salvar' : 'Criar Registro'}</Button>
      </div>
    </form>
  )
}
