import React, { useState, useEffect, useMemo } from 'react'
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
import { MultiSelect, MultiSelectOption } from '@/components/ui/multi-select'
import { useAppContext } from '@/store/AppContext'
import { useAuth } from '@/hooks/use-auth'
import { isManager } from '@/lib/user-scope'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { COUNTRIES } from '@/lib/countries'
import { createFactoryPB, updateFactoryPB } from '@/services/factories'
import { logActivity } from '@/services/activity-logs'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { normalizeArray } from '@/lib/utils'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import { UserCog } from 'lucide-react'
import { toast } from 'sonner'

interface FactoryFormProps {
  factory?: Factory
  onSubmit: () => void
}

export const CANONICAL_SPECIES = ['Aves', 'Suinos', 'Ruminantes', 'Pet', 'Multiespécies']

export const SPECIES_OPTIONS = CANONICAL_SPECIES

const REGION_OPTIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

const PRIORITY_OPTIONS: MultiSelectOption[] = [
  { label: 'Alta (Verde)', value: 'High' },
  { label: 'Média (Amarelo)', value: 'Medium' },
  { label: 'Baixa (Vermelho)', value: 'Low' },
]

const STATUS_OPTIONS = ['Atendido', 'Não atendido', 'Prospeção']

const PRODUCT_LINE_OPTIONS = [
  'Adsorventes',
  'Prebióticos',
  'Minerais Orgânicos',
  'Blends',
  'Ingredientes',
]

const CARTEIRA_DIRECT_OPTIONS = ['Indústria', 'Produtor']

const CARTEIRA_INDIRECT_OPTIONS = [
  'Representantes',
  'Distribuidores',
  'Revendas',
  'Cooperativas',
  'Indústrias',
]

const CARTEIRA_DEFAULT_OPTIONS = [
  'Indústria',
  'Produtor',
  'Representantes',
  'Distribuidores',
  'Revendas',
  'Cooperativas',
  'Integradora',
  'Premixeira',
  'Outros',
]

export function FactoryForm({ factory, onSubmit }: FactoryFormProps) {
  const { addFactory, updateFactory } = useAppContext()
  const { user } = useAuth()
  const { logAction } = useFunnelActivityLog()
  const userIsManager = isManager(user)
  const userArea = user?.geographicArea || ''
  const [teamMembers, setTeamMembers] = useState<GestaoTecnica[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [vendedorId, setVendedorId] = useState<string>(factory?.vendedor_id || '')
  const [vendedorTouched, setVendedorTouched] = useState<boolean>(false)

  const [species, setSpecies] = useState<string[]>(() => {
    if (!factory?.animalSpecies) return ['Ruminantes']
    const rawList = normalizeArray(factory.animalSpecies)
    return rawList.map((sp) => {
      const trimmed = String(sp).trim()
      if (trimmed.toLowerCase() === 'multi espécie' || trimmed.toLowerCase() === 'multi especie') {
        return 'Multiespécies'
      }
      return trimmed
    })
  })
  const [regions, setRegions] = useState<string[]>(() =>
    factory?.region ? normalizeArray(factory.region) : ['Norte'],
  )
  const [priorities, setPriorities] = useState<string[]>(() =>
    factory?.priority ? normalizeArray(factory.priority) : ['Medium'],
  )
  const [statuses, setStatuses] = useState<string[]>(() =>
    factory?.status ? normalizeArray(factory.status) : ['Prospeção'],
  )
  const [productLines, setProductLines] = useState<string[]>(() =>
    factory?.productLineAffinity ? normalizeArray(factory.productLineAffinity) : ['Adsorventes'],
  )
  const [carteira, setCarteira] = useState<string[]>(() =>
    factory?.profile_type ? normalizeArray(factory.profile_type) : ['Indústria'],
  )

  const [carteiraSegmento, setCarteiraSegmento] = useState<string>(factory?.carteira || '')
  const [grupoCliente, setGrupoCliente] = useState<string>(factory?.grupo_cliente || '')
  const [salesChannelState, setSalesChannelState] = useState<string>(
    (factory?.salesChannel as string) || '',
  )
  const [submitting, setSubmitting] = useState(false)

  const carteiraProfileOptions = useMemo(() => {
    if (salesChannelState === 'Direct') {
      return CARTEIRA_DIRECT_OPTIONS
    }
    if (salesChannelState === 'Indirect') {
      return CARTEIRA_INDIRECT_OPTIONS
    }
    return CARTEIRA_DEFAULT_OPTIONS
  }, [salesChannelState])

  useEffect(() => {
    getGestaoTecnica()
      .then((all) => {
        const active = all
          .filter((m) => m.ativo !== false)
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
        setTeamMembers(active)
      })
      .catch(() => {})
  }, [])

  // Auto-vínculo no cadastro:
  // Se for um novo cliente (não edição) e o vendedor ainda não tiver sido alterado manualmente:
  // Vincular automaticamente ao usuário logado, EXCETO se for Fernanda Franco.
  useEffect(() => {
    if (factory) return // Em edição, preservar o que já está salvo
    if (vendedorTouched) return // Se o usuário já alterou o campo, respeitar a escolha manual
    if (!user) return

    // Verificar se é Fernanda Franco
    const isFernanda =
      (user.email || '').toLowerCase().includes('fernanda.franco') ||
      (user.name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase() === 'fernanda franco'

    if (isFernanda) {
      // Fernanda Franco não recebe auto-vínculo comercial: campo fica vazio a menos que ela selecione
      return
    }

    // Tentar resolver pelo gestao_tecnica_id do usuário ou pelo nome na lista de membros
    if (user.gestao_tecnica_id) {
      setVendedorId(user.gestao_tecnica_id)
      return
    }

    if (teamMembers.length > 0 && user.name) {
      const normUserName = user.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
      const match = teamMembers.find(
        (m) =>
          m.nome
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase() === normUserName,
      )
      if (match) {
        setVendedorId(match.id)
      }
    }
  }, [factory, vendedorTouched, user, teamMembers])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const deadlineValue = fd.get('deadline') as string
    const focusValue = fd.get('focusLevel') as string
    const finalFocus = isNaN(Number(focusValue)) ? focusValue : Number(focusValue)

    // Resolver dados do vendedor responsável selecionado ou auto-vinculado
    const selectedMember = teamMembers.find((v) => v.id === vendedorId)
    let finalVendedorId: string | undefined =
      vendedorId && vendedorId !== 'none' ? vendedorId : undefined
    let finalVendedorName: string | undefined = selectedMember?.nome

    // Se não encontrou em teamMembers mas vendedorId foi setado (ex: id direto de gestao_tecnica)
    if (!finalVendedorName && finalVendedorId && user?.gestao_tecnica_id === finalVendedorId) {
      finalVendedorName = user.name || user.email
    }

    // Se for um novo cadastro e o usuário logado NÃO for Fernanda Franco, garantir fallback de auto-vínculo
    if (!factory && !finalVendedorId && user) {
      const isFernanda =
        (user.email || '').toLowerCase().includes('fernanda.franco') ||
        (user.name || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase() === 'fernanda franco'

      if (!isFernanda && !vendedorTouched) {
        finalVendedorId = user.gestao_tecnica_id || undefined
        finalVendedorName = user.name || user.email
      }
    }

    const errors: Record<string, string> = {}
    if (!fd.get('name')) errors.name = 'Nome é obrigatório'
    if (!fd.get('city')) errors.city = 'Cidade é obrigatória'
    if (species.length === 0) {
      errors.species = 'Selecione ao menos uma espécie'
    } else {
      const hasInvalidSpecies = species.some((sp) => !CANONICAL_SPECIES.includes(sp))
      if (hasInvalidSpecies) {
        errors.species = 'Espécie inválida — aceitos: Aves, Suinos, Ruminantes, Pet, Multiespécies'
      }
    }
    if (regions.length === 0) errors.regions = 'Selecione ao menos uma região'
    if (carteira.length === 0) errors.carteira = 'Selecione ao menos um perfil em carteira'
    if (priorities.length === 0) errors.priorities = 'Selecione ao menos uma prioridade'
    if (statuses.length === 0) errors.statuses = 'Selecione ao menos um status'
    if (productLines.length === 0) errors.productLines = 'Selecione ao menos uma tendência de linha'

    const prob = Number(fd.get('winProbability'))
    if (isNaN(prob) || prob < 0 || prob > 100) errors.winProbability = 'Deve estar entre 0 e 100'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const data: Partial<Factory> = {
      name: fd.get('name') as string,
      city: fd.get('city') as string,
      region: regions as unknown as Region,
      animalSpecies: species as unknown as Factory['animalSpecies'],
      profile_type: carteira as unknown as Factory['profile_type'],
      priority: priorities as unknown as Priority,
      focusLevel: finalFocus,
      productLineAffinity: productLines as unknown as ProductLine,
      capacity: Number(fd.get('capacity')),
      potentialValue: Number(fd.get('potentialValue')),
      status: statuses as unknown as Status,
      funnelStage: fd.get('funnelStage') as FunnelStage,
      winProbability: Number(fd.get('winProbability')),
      stateRegion: (userIsManager ? fd.get('stateRegion') : userArea) as Factory['stateRegion'],
      deadline: deadlineValue ? new Date(deadlineValue).toISOString() : undefined,
      lastInteraction: factory?.lastInteraction || new Date().toISOString(),
      country: (fd.get('country') as string) || 'Brasil',
      state: (fd.get('state') as string) || undefined,
      gestor_tecnico_id: factory?.gestor_tecnico_id || undefined,
      gestor_tecnico_name: factory?.gestor_tecnico_name || undefined,
      vendedor_id: finalVendedorId,
      vendedor_name: finalVendedorName,
      salesOwner: factory?.salesOwner || (user?.id ? user.id : undefined),
      salesChannel: (salesChannelState as Factory['salesChannel']) || undefined,
      indirectChannelType:
        (fd.get('indirectChannelType') as Factory['indirectChannelType']) || undefined,
      suggested_approach: (fd.get('suggested_approach') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
      carteira: carteiraSegmento && carteiraSegmento !== 'none' ? carteiraSegmento : undefined,
      grupo_cliente: grupoCliente && grupoCliente !== 'none' ? grupoCliente : undefined,
      contato: (fd.get('contato') as string) || undefined,
      status_contato:
        (fd.get('status_contato') as string) && fd.get('status_contato') !== 'none'
          ? (fd.get('status_contato') as Factory['status_contato'])
          : undefined,
    }

    setSubmitting(true)
    try {
      if (factory) {
        await updateFactoryPB(factory.id, data)
        updateFactory(factory.id, data)
        logActivity(
          `Fábrica atualizada: ${data.name}`,
          `Vendedor: ${finalVendedorName || 'Não atribuído'}, Espécies: ${species.join(', ')}, Carteira: ${carteira.join(', ')}`,
          factory.id,
          'factories',
        ).catch(() => {})
        // Funnel activity log: factory updated
        logAction({
          action_type: 'update',
          entity_type: 'factory',
          entity_id: factory.id,
          entity_name: data.name,
          description: `Atualizou fábrica ${data.name}`,
        })
        // Funnel activity log: status do contato alterado
        if (factory.status_contato !== data.status_contato) {
          logAction({
            action_type: 'status_change',
            entity_type: 'factory',
            entity_id: factory.id,
            entity_name: data.name,
            old_value: factory.status_contato || 'Sem status',
            new_value: data.status_contato || 'Sem status',
            description: `Alterou status do contato ${data.contato || 'N/A'} na fabrica ${data.name} para ${data.status_contato || 'Sem status'}`,
          })
        }
        // If a sales owner was assigned/changed, log an assign action
        if (data.salesOwner && factory.salesOwner !== data.salesOwner) {
          logAction({
            action_type: 'assign',
            entity_type: 'team_member',
            entity_id: data.salesOwner,
            entity_name: data.name,
            old_value: factory.salesOwner || '',
            new_value: data.salesOwner,
            description: `Atribuiu responsavel ao negocio ${data.name}`,
          })
        }
        // If the funnel stage changed, log a deal move as well
        if (factory.funnelStage && data.funnelStage && factory.funnelStage !== data.funnelStage) {
          logAction({
            action_type: 'move',
            entity_type: 'deal',
            entity_id: factory.id,
            entity_name: data.name,
            old_value: factory.funnelStage,
            new_value: data.funnelStage,
            description: `Moveu negocio ${data.name} de ${factory.funnelStage} para ${data.funnelStage}`,
          })
        }
        toast.success('Fábrica atualizada com sucesso')
      } else {
        const created = await createFactoryPB(data)
        addFactory({ ...data, id: created.id })
        logActivity(
          `Nova fábrica cadastrada: ${data.name}`,
          `Vendedor: ${finalVendedorName || 'Não atribuído'}, Espécies: ${species.join(', ')}, Carteira: ${carteira.join(', ')}`,
          created.id,
          'factories',
        ).catch(() => {})
        // Funnel activity log: client created
        logAction({
          action_type: 'create',
          entity_type: 'client',
          entity_id: created.id,
          entity_name: data.name,
          description: `Cadastrou cliente ${data.name}`,
        })
        toast.success('Fábrica cadastrada com sucesso')
      }
      onSubmit()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
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
          <Label>Região (Múltipla Seleção)</Label>
          <MultiSelect
            options={REGION_OPTIONS}
            value={regions}
            onChange={setRegions}
            placeholder="Selecione as Regiões"
          />
          {fieldErrors.regions && <p className="text-xs text-destructive">{fieldErrors.regions}</p>}
        </div>

        <div className="space-y-2">
          <Label>Espécie Animal (Múltipla Seleção)</Label>
          <MultiSelect
            options={SPECIES_OPTIONS}
            value={species}
            onChange={setSpecies}
            placeholder="Selecione as Espécies"
          />
          {fieldErrors.species && <p className="text-xs text-destructive">{fieldErrors.species}</p>}
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

        <div className="space-y-2">
          <Label>Carteira - Tipo de Perfil (Múltipla Seleção)</Label>
          <MultiSelect
            options={carteiraProfileOptions}
            value={carteira}
            onChange={setCarteira}
            placeholder="Selecione o Perfil do Cliente"
          />
          {fieldErrors.carteira && (
            <p className="text-xs text-destructive">{fieldErrors.carteira}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Prioridade (Múltipla Seleção)</Label>
          <MultiSelect
            options={PRIORITY_OPTIONS}
            value={priorities}
            onChange={setPriorities}
            placeholder="Selecione as Prioridades"
          />
          {fieldErrors.priorities && (
            <p className="text-xs text-destructive">{fieldErrors.priorities}</p>
          )}
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
          <Label>Status (Múltipla Seleção)</Label>
          <MultiSelect
            options={STATUS_OPTIONS}
            value={statuses}
            onChange={setStatuses}
            placeholder="Selecione os Status"
          />
          {fieldErrors.statuses && (
            <p className="text-xs text-destructive">{fieldErrors.statuses}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tendência de Linha - Blink (Múltipla Seleção)</Label>
          <MultiSelect
            options={PRODUCT_LINE_OPTIONS}
            value={productLines}
            onChange={setProductLines}
            placeholder="Selecione as Linhas"
          />
          {fieldErrors.productLines && (
            <p className="text-xs text-destructive">{fieldErrors.productLines}</p>
          )}
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
            <UserCog className="w-4 h-4 text-primary" /> Atribuição de Vendedor
          </h3>
          <div className="space-y-2">
            <Label>Vendedor Responsável</Label>
            <Select
              value={vendedorId || 'none'}
              onValueChange={(val) => {
                setVendedorTouched(true)
                setVendedorId(val)
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecione Vendedor" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                {teamMembers.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.nome} —{' '}
                    <span className="text-muted-foreground">
                      {v.funcao === 'vendedor'
                        ? 'vendedor'
                        : v.funcao?.replace(/_/g, ' ') || 'membro'}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {salesChannelState === 'Indirect' && (
          <div className="space-y-2 md:col-span-2">
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
              <SelectItem value="none">Não informada</SelectItem>
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
              <SelectItem value="none">Não informado</SelectItem>
              <SelectItem value="Indústrias">Indústrias</SelectItem>
              <SelectItem value="Distribuidores Diretos">Distribuidores Diretos</SelectItem>
              <SelectItem value="Produtores Diretos">Produtores Diretos</SelectItem>
              <SelectItem value="Premixeras">Premixeras</SelectItem>
              <SelectItem value="Cooperativas">Cooperativas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contato (Pessoa no Prospect)</Label>
          <Input
            name="contato"
            defaultValue={factory?.contato}
            placeholder="Nome da pessoa de contato"
          />
        </div>
        <div className="space-y-2">
          <Label>Status do Contato</Label>
          <Select name="status_contato" defaultValue={factory?.status_contato || 'none'}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não informado</SelectItem>
              <SelectItem value="Champion">Champion</SelectItem>
              <SelectItem value="Stakeholder">Stakeholder</SelectItem>
              <SelectItem value="Decisor">Decisor</SelectItem>
              <SelectItem value="Influenciador">Influenciador</SelectItem>
              <SelectItem value="Gatekeepers">Gatekeepers</SelectItem>
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
        <Button type="button" variant="outline" onClick={onSubmit} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar Fábrica'}
        </Button>
      </div>
    </form>
  )
}
