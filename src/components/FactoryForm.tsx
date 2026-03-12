import React from 'react'
import { Factory, Region, Status, FunnelStage } from '@/types'
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

interface FactoryFormProps {
  factory?: Factory
  onSubmit: () => void
}

export function FactoryForm({ factory, onSubmit }: FactoryFormProps) {
  const { addFactory, updateFactory } = useAppContext()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const data: Partial<Factory> = {
      name: fd.get('name') as string,
      city: fd.get('city') as string,
      region: fd.get('region') as Region,
      capacity: Number(fd.get('capacity')),
      potentialValue: Number(fd.get('potentialValue')),
      status: fd.get('status') as Status,
      funnelStage: fd.get('funnelStage') as FunnelStage,
      winProbability: Number(fd.get('winProbability')),
      lastInteraction: new Date().toISOString(),
    }

    if (factory) {
      updateFactory(factory.id, data)
    } else {
      addFactory(data)
    }
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da Fábrica</Label>
          <Input name="name" defaultValue={factory?.name} required />
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input name="city" defaultValue={factory?.city} required />
        </div>
        <div className="space-y-2">
          <Label>Região</Label>
          <Select name="region" defaultValue={factory?.region || 'Norte'}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {['Norte', 'Sul', 'Leste', 'Oeste', 'Médio-Norte'].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select name="status" defaultValue={factory?.status || 'Prospeção'}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {['Atendido', 'Não atendido', 'Prospeção'].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Capacidade (ton/mês)</Label>
          <Input type="number" name="capacity" defaultValue={factory?.capacity} required />
        </div>
        <div className="space-y-2">
          <Label>Potencial (R$)</Label>
          <Input
            type="number"
            name="potentialValue"
            defaultValue={factory?.potentialValue}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Estágio no Funil</Label>
          <Select name="funnelStage" defaultValue={factory?.funnelStage || 'Lead'}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {[
                'Lead',
                'Primeiro Contato',
                'Diagnóstico Técnico',
                'Apresentação',
                'Teste/Trial',
                'Proposta',
                'Negociação',
                'Fechamento',
                'Pós-venda',
                'Perda',
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Probabilidade (%)</Label>
          <Input
            type="number"
            name="winProbability"
            min={0}
            max={100}
            defaultValue={factory?.winProbability || 10}
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onSubmit}>
          Cancelar
        </Button>
        <Button type="submit">Salvar Fábrica</Button>
      </div>
    </form>
  )
}
