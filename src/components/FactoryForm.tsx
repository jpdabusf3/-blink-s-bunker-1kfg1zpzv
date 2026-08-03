import React, { useState, useEffect } from 'react'
import { Factory, Region, Status, FunnelStage, ProductLine, Priority } from '@/types'
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
import { useAuth } from '@/hooks/use-auth'
import { isManager } from '@/lib/user-scope'
import { getUsers, type UserListItem } from '@/services/users'
import { COUNTRIES } from '@/lib/countries'

interface FactoryFormProps {
  factory?: Factory
  onSubmit: () => void
}

export function FactoryForm({ factory, onSubmit }: FactoryFormProps) {
  const { addFactory, updateFactory } = useAppContext()
  const { user } = useAuth()
  const userIsManager = isManager(user)
  const userArea = user?.geographicArea || ''
  const defaultStateRegion = factory?.stateRegion || userArea || 'Sul'
  const [users, setUsers] = useState<UserListItem[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])
  const sellers = users.filter((u) =>
    ['Vendedor', 'Manager', 'Gerente', 'Gestor', 'Diretor', 'CEO', 'Comum'].includes(u.job_title),
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const deadlineValue = fd.get('deadline') as string
    const focusValue = fd.get('focusLevel') as string
    const finalFocus = isNaN(Number(focusValue)) ? focusValue : Number(focusValue)
    const salesOwnerValue = fd.get('salesOwner') as string
    const salesOwnerName = users.find((u) => u.id === salesOwnerValue)?.name || ''

    const errors: Record<string, string> = {}
    if (!fd.get('name')) errors.name = 'Nome é obrigatório'
    if (!fd.get('city')) errors.city = 'Cidade é obrigatória'
    const prob = Number(fd.get('winProbability'))
    if (isNaN(prob) || prob < 0 || prob > 100) errors.winProbability = 'Deve estar entre 0 e 100'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const data: Partial<Factory> = {
      name: fd.get('name') as string,
      city: fd.get('city') as string,
      region: fd.get('region') as Region,
      sector: fd.get('sector') as string,
      animalSpecies: fd.get('animalSpecies') as string,
      priority: fd.get('priority') as Priority,
      focusLevel: finalFocus,
      productLineAffinity: fd.get('productLineAffinity') as ProductLine,
      capacity: Number(fd.get('capacity')),
      potentialValue: Number(fd.get('potentialValue')),
      status: fd.get('status') as Status,
      funnelStage: fd.get('funnelStage') as FunnelStage,
      winProbability: Number(fd.get('winProbability')),
      stateRegion: (userIsManager ? fd.get('stateRegion') : userArea) as Factory['stateRegion'],
      deadline: deadlineValue ? new Date(deadlineValue).toISOString() : undefined,
      lastInteraction: factory?.lastInteraction || new Date().toISOString(),
      country: (fd.get('country') as string) || 'Brasil',
      state: (fd.get('state') as string) || undefined,
      salesOwner: salesOwnerValue || undefined,
      salesOwnerName: salesOwnerName || undefined,
      profile_type: (fd.get('profile_type') as string) || undefined,
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
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input name="city" defaultValue={factory?.city} required />
          {fieldErrors.city && <p className="text-xs text-destructive">{fieldErrors.city}</p>}
        </div>
        <div className="space-y-2">
          <Label>País</Label>
          <Select name="country" defaultValue={factory?.country || 'Brasil'}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Estado (UF)</Label>
          <Input name="state" defaultValue={factory?.state} placeholder="Ex: SP, PR, MG" />
        </div>
        <div className="space-y-2">
          <Label>Região</Label>
          <Select name="region" defaultValue={factory?.region || 'Norte'} required>
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
          <Label>Prioridade</Label>
          <Select name="priority" defaultValue={factory?.priority || 'Medium'} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">Alta (Verde)</SelectItem>
              <SelectItem value="Medium">Média (Amarelo)</SelectItem>
              <SelectItem value="Low">Baixa (Vermelho)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nível de Foco (1-5 ou 'Cliente')</Label>
          <Input
            name="focusLevel"
            defaultValue={factory?.focusLevel?.toString()}
            placeholder="Ex: 5 ou Cliente"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select name="status" defaultValue={factory?.status || 'Prospeção'} required>
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
          <Label>Tipo de Perfil (Carteira)</Label>
          <Select name="profile_type" defaultValue={factory?.profile_type || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {[
                'Indústria',
                'Cooperativa',
                'Integradora',
                'Premixeira',
                'Produtores',
                'Distribuidor',
                'Outros',
              ].map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Setor de Atuação (Especialidades)</Label>
          <Select name="sector" defaultValue={factory?.sector || 'Ruminantes'} required>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {[
                'Aves',
                'Aves/Suínos',
                'Aves/Suínos, Pet',
                'Bovinos de Corte',
                'Bovinos de Leite',
                'Geral',
                'Muitiespecies',
                'PET',
                'Ruminantes',
                'Ruminantes, Pet',
                'Suínos',
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Espécie Animal</Label>
          <Select name="animalSpecies" defaultValue={factory?.animalSpecies || 'Bovinos'}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {[
                'Bovinos',
                'Suínos',
                'Aves',
                'Aqua',
                'PET',
                'Equinos',
                'Caprinos',
                'Ovinos',
                'Multiespécie',
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tendência de Linha (Blink)</Label>
          <Select
            name="productLineAffinity"
            defaultValue={factory?.productLineAffinity || 'Adsorventes'}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {['Adsorventes', 'Prebióticos', 'Minerais Orgânicos', 'Blends', 'Ingredientes'].map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ),
              )}
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
          <Select name="funnelStage" defaultValue={factory?.funnelStage || 'Lead'} required>
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
          {fieldErrors.winProbability && (
            <p className="text-xs text-destructive">{fieldErrors.winProbability}</p>
          )}
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Prazo Limite de Negociação</Label>
          <Input
            type="date"
            name="deadline"
            defaultValue={factory?.deadline ? factory.deadline.split('T')[0] : ''}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Será gerado um alerta quando o prazo estiver próximo do fim.
          </p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Gestor Técnico / Vendedor Responsável</Label>
          <Select name="salesOwner" defaultValue={factory?.salesOwner || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Atribuir vendedor" />
            </SelectTrigger>
            <SelectContent>
              {sellers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || s.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
