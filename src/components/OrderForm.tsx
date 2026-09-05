import React from 'react'
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
import { useAppContext } from '@/store/AppContext'
import { useToast } from '@/hooks/use-toast'
import { Order } from '@/types'

interface OrderFormProps {
  onSubmit: () => void
  initialFactoryId?: string
  initialOrder?: Order
}

export function OrderForm({ onSubmit, initialFactoryId, initialOrder }: OrderFormProps) {
  const { factories, addOrder, updateOrder } = useAppContext()
  const { toast } = useToast()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const factoryId = fd.get('factoryId') as string
    if (!factoryId || factoryId === 'all') {
      toast({
        title: 'Atenção',
        description: 'Por favor, selecione uma fábrica válida.',
        variant: 'destructive',
      })
      return
    }

    const orderData = {
      factoryId,
      product: fd.get('product') as string,
      line: fd.get('line') as string,
      quantity: Number(fd.get('quantity')),
      unitValue: Number(fd.get('unitValue')),
    }

    if (initialOrder) {
      updateOrder(initialOrder.id, orderData)
      toast({
        title: 'Sucesso',
        description: 'Pedido atualizado com sucesso!',
      })
    } else {
      addOrder(orderData)
      toast({
        title: 'Sucesso',
        description: 'Pedido registrado com sucesso!',
      })
    }
    onSubmit()
  }

  // Sort factories by priority then name for easier selection
  const sortedFactories = [...factories].sort((a, b) => {
    const pMap: Record<string, number> = { High: 1, Medium: 2, Low: 3 }
    const prioA = Array.isArray(a.priority) ? a.priority[0] : a.priority
    const prioB = Array.isArray(b.priority) ? b.priority[0] : b.priority
    const pA = pMap[prioA || 'Medium'] || 2
    const pB = pMap[prioB || 'Medium'] || 2
    if (pA !== pB) return pA - pB
    return a.name.localeCompare(b.name)
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Fábrica</Label>
        <Select
          name="factoryId"
          defaultValue={
            initialOrder?.factoryId ||
            (initialFactoryId && initialFactoryId !== 'all' ? initialFactoryId : '')
          }
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a fábrica associada" />
          </SelectTrigger>
          <SelectContent>
            {sortedFactories.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name} {f.priority === 'High' ? '(Alta Prioridade)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Produto</Label>
          <Input
            name="product"
            defaultValue={initialOrder?.product}
            placeholder="Ex: Blink Minerais+"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Linha</Label>
          <Select name="line" defaultValue={initialOrder?.line || 'Adsorventes'} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a linha" />
            </SelectTrigger>
            <SelectContent>
              {['Adsorventes', 'Prebióticos', 'Minerais Orgânicos', 'Blends', 'Ingredientes'].map(
                (l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quantidade</Label>
          <Input
            type="number"
            name="quantity"
            defaultValue={initialOrder?.quantity}
            min={1}
            required
            placeholder="Ex: 50"
          />
        </div>
        <div className="space-y-2">
          <Label>Preço Unitário (R$)</Label>
          <Input
            type="number"
            step="0.01"
            name="unitValue"
            defaultValue={initialOrder?.unitValue}
            min={0.01}
            required
            placeholder="Ex: 120.00"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSubmit}>
          Cancelar
        </Button>
        <Button type="submit">{initialOrder ? 'Salvar Alterações' : 'Salvar Pedido'}</Button>
      </div>
    </form>
  )
}
