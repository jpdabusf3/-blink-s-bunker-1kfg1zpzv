import React, { useState, useEffect } from 'react'
import { Factory, Region, Status, FunnelStage, ProductLine, Priority } from '@/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import { COUNTRIES } from '@/lib/countries'
import { createFactoryPB, updateFactoryPB } from '@/services/factories'
import { logActivity } from '@/services/activity-logs'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { UserCog } from 'lucide-react'
import { toast } from 'sonner'

interface FactoryFormProps {
  factory?: Factory
  onSubmit: () => void
}

const SPECIES_OPTIONS = [
  'Ruminantes',
  'Aves',
  'Suinos',
  'Pet',
  'Aqua',
  'Equinos',
  'Outros',
  'Multi espécie',
]

const CARTEIRA_OPTIONS = [
  'Indústria',
  'Cooperativa',
  'Integradora',
  'Premixeira',
  'Produtores',
  'Outros',
  'Distribuidor',
]

export function FactoryForm({ factory, onSubmit }: FactoryFormProps) {
  const { addFactory, updateFactory } = useAppContext()
  const { user } = useAuth()
  const userIsManager = isManager(user)
  const userArea = user?.geographicArea || ''
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [gestorTecnicoId, setGestorTecnicoId] = useState<string>(factory?.gestor_tecnico_id || '')
  const [vendedorId, setVendedorId] = useState<string>(factory?.vendedor_id || '')
  const [species, setSpecies] = useState<string>(factory?.animalSpecies || 'Ruminantes')
  const [carteira, setCarteira] = useState<string>(factory?.profile_type || 'Indústria')
  const [carteiraSegmento, setCarteiraSegmento] = useState<string>(factory?.carteira || '')
  const [grupoCliente, setGrupoCliente] = useState<string>(factory?.grupo_cliente || '')
  const [salesChannelState, setSalesChannelState] = useState<string>(
    (factory?.salesChannel as string) || '',
  )

  useEffect(() => {
    Promise.all([getGestoresTecnicos(), getVendedoresGestao()])
      .then(([g, v]) => {
        setGestores(g)
        setVendedores(v)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const deadlineValue = fd.get('deadline') as string
    const focusValue = fd.get('focusLevel') as string
    const finalFocus = isNaN(Number(focusValue)) ? focusValue : Number(focusValue)

    const gestorTecnico = gestores.find((g) => g.id === gestorTecnicoId)
    const vendedor = vendedores.find((v) => v.id === vendedorId)

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
      animalSpecies: species,
      profile_type: carteira,
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
      gestor_tecnico_id:
        gestorTecnicoId && gestorTecnicoId !== 'none' ? gestorTecnicoId : undefined,
      gestor_tecnico_name: gestorTecnico?.nome || undefined,
      vendedor_id: vendedorId && vendedorId !== 'none' ? vendedorId : undefined,
      vendedor_name: vendedor?.nome || undefined,
      salesChannel: (salesChannelState as Factory['salesChannel']) || undefined,
      indirectChannelType:
        (fd.get('indirectChannelType') as Factory['indirectChannelType']) || undefined,
      suggested_approach: (fd.get('suggested_approach') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
      carteira: carteiraSegmento || undefined,
      grupo_cliente: grupoCliente || undefined,
    }

    try {
      if (factory) {
        await updateFactoryPB(factory.id, data)
        updateFactory(factory.id, data)
        logActivity(
          `Fábrica atualizada: ${data.name}`,
          `Gestor Técnico: ${gestorTecnico?.nome || 'Não atribuído'}, Vendedor: ${vendedor?.nome || 'Não atribuído'}, Espécie: ${species}, Carteira: ${carteira}`,
          factory.id,
          'factories',
        ).catch(() => {})
        toast.success('Fábrica atualizada com sucesso')
      } else {
        const created = await createFactoryPB(data)
        addFactory({ ...data, id: created.id })
        logActivity(
          `Nova fábrica cadastrada: ${data.name}`,
          `Gestor Técnico: ${gestorTecnico?.nome || 'Não atribuído'}, Vendedor: ${vendedor?.nome || 'Não atribuído'}, Espécie: ${species}, Carteira: ${carteira}`,
          created.id,
          'factories',
        ).catch(() => {})
        toast.success('Fábrica cadastrada com sucesso')
      }
      onSubmit()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da Fábrica / Cliente</Label>
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
          <Label>Espécie Animal</Label>
          <Select value={species} onValueChange={setSpecies}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a Espécie" />
            </SelectTrigger>
            <SelectContent>
              {SPECIES_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Carteira (Tipo de Perfil)</Label>
          <Select value={carteira} onValueChange={setCarteira}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a Carteira" />
            </SelectTrigger>
            <SelectContent>
              {CARTEIRA_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
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
          <Label>Setor de Atuação</Label>
          <Input name="sector" defaultValue={factory?.sector || 'Ruminantes'} required />
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
        </div>

        {/* Dedicated Responsibility Assignment UI */}
        <div className="space-y-4 md:col-span-2 p-4 border rounded-lg bg-muted/20">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
            <UserCog className="w-4 h-4 text-primary" /> Atribuição de Responsáveis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gestor Técnico</Label>
              <Select value={gestorTecnicoId || 'none'} onValueChange={setGestorTecnicoId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione Gestor Técnico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                  {gestores.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vendedor Responsável</Label>
              <Select value={vendedorId || 'none'} onValueChange={setVendedorId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Canal de Vendas</Label>
          <Select
            name="salesChannel"
            value={salesChannelState}
            onValueChange={setSalesChannelState}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Direct">Direto</SelectItem>
              <SelectItem value="Indirect">Indireto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {salesChannelState === 'Indirect' && (
          <div className="space-y-2">
            <Label>Tipo de Canal Indireto</Label>
            <Select name="indirectChannelType" defaultValue={factory?.indirectChannelType || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {['Representantes', 'Distribuidores', 'Revendas', 'Cooperativas', 'Indústrias'].map(
                  (t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Carteira (Segmento de Negócio)</Label>
          <Select value={carteiraSegmento} onValueChange={setCarteiraSegmento}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Não informada</SelectItem>
              <SelectItem value="AVES">Aves</SelectItem>
              <SelectItem value="PETS">Pets</SelectItem>
              <SelectItem value="RUMINANTES">Ruminantes</SelectItem>
              <SelectItem value="SUINOS">Suínos</SelectItem>
              <SelectItem value="AQUA">Aqua</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Grupo de Cliente</Label>
          <Select value={grupoCliente} onValueChange={setGrupoCliente}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Não informado</SelectItem>
              <SelectItem value="Indústrias">Indústrias</SelectItem>
              <SelectItem value="Distribuidores Diretos">Distribuidores Diretos</SelectItem>
              <SelectItem value="Produtores Diretos">Produtores Diretos</SelectItem>
              <SelectItem value="Premixeras">Premixeras</SelectItem>
              <SelectItem value="Cooperativas">Cooperativas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Próximos Passos / Abordagem Sugerida</Label>
          <Textarea
            name="suggested_approach"
            defaultValue={factory?.suggested_approach || factory?.notes}
            placeholder="Ex: Agendar reunião presencial para apresentar linha de Adsorventes em Maio..."
            className="h-20"
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
