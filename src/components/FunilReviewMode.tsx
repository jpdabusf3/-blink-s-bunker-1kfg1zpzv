import { useState, useMemo, useEffect } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import { updateFactoryPB } from '@/services/factories'
import { getUsers, type UserListItem } from '@/services/users'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Save, UserCheck, Search, Filter } from 'lucide-react'
import { UserFilter } from '@/components/UserFilter'
import type { Factory } from '@/types'

const SPECIES = [
  'Bovinos',
  'Suínos',
  'Aves',
  'Aqua',
  'PET',
  'Equinos',
  'Caprinos',
  'Ovinos',
  'Multiespécie',
]
const STATUSES = ['Atendido', 'Não atendido', 'Prospeção']
const STAGES = [
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
]
const PROFILE_TYPES = [
  'Indústria',
  'Cooperativa',
  'Integradora',
  'Premixeira',
  'Produtores',
  'Distribuidor',
  'Outros',
]
const REGIONS = [
  'Sul',
  'Norte',
  'Oeste',
  'Leste',
  'Nordeste',
  'Noroeste',
  'Sudeste',
  'Sudoeste',
  'Centro',
]

export function FunilReviewMode() {
  const { updateFactory } = useAppContext()
  const factories = useScopedFactories()
  const { logAction } = useFunnelActivityLog()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [batchPriority, setBatchPriority] = useState('')
  const [batchProb, setBatchProb] = useState('')
  const [batchOwner, setBatchOwner] = useState('')

  const [filters, setFilters] = useState({
    species: 'all',
    status: 'all',
    stage: 'all',
    country: 'all',
    region: 'all',
    profile: 'all',
    owner: 'all',
  })

  const [editValues, setEditValues] = useState<
    Record<
      string,
      {
        priority?: string
        winProbability?: string
        salesOwner?: string
        suggested_approach?: string
      }
    >
  >({})

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
  }, [])

  const sellers = useMemo(
    () =>
      users.filter((u) =>
        ['Vendedor', 'Manager', 'Gerente', 'Gestor', 'Diretor', 'CEO', 'Comum'].includes(
          u.job_title,
        ),
      ),
    [users],
  )

  const countries = useMemo(
    () => Array.from(new Set(factories.map((f) => f.country).filter(Boolean))),
    [factories],
  )

  const filtered = useMemo(
    () =>
      factories.filter((f) => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase()
          const nameMatch = f.name.toLowerCase().includes(q)
          const cityMatch = f.city?.toLowerCase().includes(q)
          const ownerMatch = f.salesOwnerName?.toLowerCase().includes(q)
          if (!nameMatch && !cityMatch && !ownerMatch) return false
        }
        if (filters.species !== 'all' && f.animalSpecies !== filters.species) return false
        if (filters.status !== 'all' && f.status !== filters.status) return false
        if (filters.stage !== 'all' && f.funnelStage !== filters.stage) return false
        if (filters.country !== 'all' && f.country !== filters.country) return false
        if (filters.region !== 'all' && f.stateRegion !== filters.region) return false
        if (filters.profile !== 'all' && f.profile_type !== filters.profile) return false
        if (filters.owner !== 'all' && f.salesOwner !== filters.owner) return false
        return true
      }),
    [factories, filters, searchTerm],
  )

  const getOwnerName = (id?: string) => users.find((u) => u.id === id)?.name || ''

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) {
        n.delete(id)
      } else {
        n.add(id)
      }
      return n
    })
  }

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((f) => f.id)),
    )
  }

  const handleInlineSave = async (id: string) => {
    const edits = editValues[id]
    if (!edits) return
    const factory = factories.find((f) => f.id === id)
    const data: Partial<Factory> = {}
    if (edits.priority) data.priority = edits.priority as Factory['priority']
    if (edits.winProbability !== undefined) data.winProbability = Number(edits.winProbability)
    if (edits.suggested_approach !== undefined) data.suggested_approach = edits.suggested_approach
    if (edits.salesOwner !== undefined) {
      data.salesOwner = edits.salesOwner
      data.salesOwnerName = getOwnerName(edits.salesOwner)
    }

    if (Object.keys(data).length > 0) {
      updateFactory(id, data)
      try {
        await updateFactoryPB(id, data as any)
        // Funnel activity log: deal updated
        logAction({
          action_type: 'update',
          entity_type: 'deal',
          entity_id: id,
          entity_name: factory?.name || '',
          description: `Atualizou negocio ${factory?.name || id}`,
        })
        // If a sales owner was assigned, log an assign action
        if (data.salesOwner && factory?.salesOwner !== data.salesOwner) {
          logAction({
            action_type: 'assign',
            entity_type: 'team_member',
            entity_id: data.salesOwner,
            entity_name: factory?.name || '',
            old_value: factory?.salesOwner || '',
            new_value: data.salesOwner,
            description: `Atribuiu responsavel ao negocio ${factory?.name || id}`,
          })
        }
      } catch {
        /* noop */
      }
    }
    setEditValues((prev) => {
      const n = { ...prev }
      delete n[id]
      return n
    })
  }

  const handleBatchUpdate = async () => {
    const data: Partial<Factory> = {}
    if (batchPriority) data.priority = batchPriority as Factory['priority']
    if (batchProb !== '') data.winProbability = Number(batchProb)
    if (batchOwner) {
      data.salesOwner = batchOwner
      data.salesOwnerName = getOwnerName(batchOwner)
    }

    if (Object.keys(data).length === 0 || selected.size === 0) return

    for (const id of selected) {
      const factory = factories.find((f) => f.id === id)
      updateFactory(id, data)
      try {
        await updateFactoryPB(id, data as any)
        // Funnel activity log: deal batch updated
        logAction({
          action_type: 'update',
          entity_type: 'deal',
          entity_id: id,
          entity_name: factory?.name || '',
          description: `Atualizou negocio ${factory?.name || id} (lote)`,
        })
        // If a sales owner was assigned in the batch, log an assign action
        if (data.salesOwner && factory?.salesOwner !== data.salesOwner) {
          logAction({
            action_type: 'assign',
            entity_type: 'team_member',
            entity_id: data.salesOwner,
            entity_name: factory?.name || '',
            old_value: factory?.salesOwner || '',
            new_value: data.salesOwner,
            description: `Atribuiu responsavel ao negocio ${factory?.name || id} (lote)`,
          })
        }
      } catch {
        /* noop */
      }
    }
    setSelected(new Set())
    setBatchPriority('')
    setBatchProb('')
    setBatchOwner('')
  }

  const FSelect = ({
    label,
    value,
    onChange,
    options,
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: string[]
  }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full md:w-[140px] bg-background text-xs">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas ({label})</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 bg-card p-3 border rounded-xl shadow-subtle">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Buscar fábrica, cidade ou vendedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
        <FSelect
          label="Espécie"
          value={filters.species}
          onChange={(v) => setFilters((p) => ({ ...p, species: v }))}
          options={SPECIES}
        />
        <FSelect
          label="Perfil"
          value={filters.profile}
          onChange={(v) => setFilters((p) => ({ ...p, profile: v }))}
          options={PROFILE_TYPES}
        />
        <FSelect
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
          options={STATUSES}
        />
        <FSelect
          label="Estágio"
          value={filters.stage}
          onChange={(v) => setFilters((p) => ({ ...p, stage: v }))}
          options={STAGES}
        />
        <FSelect
          label="País"
          value={filters.country}
          onChange={(v) => setFilters((p) => ({ ...p, country: v }))}
          options={countries}
        />
        <FSelect
          label="Região"
          value={filters.region}
          onChange={(v) => setFilters((p) => ({ ...p, region: v }))}
          options={REGIONS}
        />
        <UserFilter
          value={filters.owner}
          onChange={(v) => setFilters((p) => ({ ...p, owner: v }))}
          className="w-full md:w-[140px] bg-background text-xs h-9"
        />
      </div>

      {selected.size > 0 && (
        <Card className="p-3 flex flex-wrap items-center justify-between gap-2 bg-primary/10 border-primary/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-primary">
              {selected.size} registro(s) selecionado(s)
            </span>
            <Select value={batchPriority} onValueChange={setBatchPriority}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-background">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="High">Alta (Verde)</SelectItem>
                <SelectItem value="Medium">Média (Amarelo)</SelectItem>
                <SelectItem value="Low">Baixa (Vermelho)</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Prob. %"
              value={batchProb}
              onChange={(e) => setBatchProb(e.target.value)}
              className="w-[90px] h-8 text-xs bg-background"
            />

            <Select value={batchOwner} onValueChange={setBatchOwner}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-background">
                <SelectValue placeholder="Gestor Técnico" />
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

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleBatchUpdate} className="gap-1.5 h-8 text-xs">
              <Save className="w-3.5 h-3.5" /> Aplicar em Lote
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <div className="overflow-x-auto bg-card border rounded-xl shadow-subtle">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 border-b">
            <tr>
              <th className="p-3 text-left w-10">
                <Checkbox
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="p-3 text-left font-semibold">Fábrica / Local</th>
              <th className="p-3 text-left font-semibold">Perfil & Espécie</th>
              <th className="p-3 text-left font-semibold">Status / Estágio</th>
              <th className="p-3 text-left font-semibold w-32">Prioridade</th>
              <th className="p-3 text-left font-semibold w-24">Prob (%)</th>
              <th className="p-3 text-left font-semibold">Potencial (R$)</th>
              <th className="p-3 text-left font-semibold w-48">Gestor Técnico</th>
              <th className="p-3 text-left font-semibold">Próximos Passos (Abordagem)</th>
              <th className="p-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const edits = editValues[f.id] || {}
              const currentOwner = edits.salesOwner ?? f.salesOwner ?? ''
              const currentPriority = edits.priority ?? f.priority ?? 'Medium'
              const currentProb = edits.winProbability ?? f.winProbability
              const currentNextStep =
                edits.suggested_approach ?? f.suggested_approach ?? f.notes ?? ''

              const hasEdits =
                edits.priority !== undefined ||
                edits.winProbability !== undefined ||
                edits.salesOwner !== undefined ||
                edits.suggested_approach !== undefined

              return (
                <tr key={f.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <Checkbox
                      checked={selected.has(f.id)}
                      onCheckedChange={() => toggleSelect(f.id)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-sm text-foreground">{f.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.city} • {f.state || f.country || 'Brasil'}
                    </div>
                  </td>
                  <td className="p-3 space-y-1">
                    <Badge variant="outline" className="text-[10px] block w-fit">
                      {Array.isArray(f.profile_type)
                        ? f.profile_type.join(', ')
                        : f.profile_type || 'Indústria'}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground font-medium block">
                      {Array.isArray(f.animalSpecies)
                        ? f.animalSpecies.join(', ')
                        : f.animalSpecies || 'Multiespécie'}
                    </span>
                  </td>
                  <td className="p-3 space-y-1">
                    <Badge
                      variant={
                        (
                          Array.isArray(f.status)
                            ? f.status.includes('Atendido')
                            : f.status === 'Atendido'
                        )
                          ? 'default'
                          : (
                                Array.isArray(f.status)
                                  ? f.status.includes('Prospeção')
                                  : f.status === 'Prospeção'
                              )
                            ? 'secondary'
                            : 'outline'
                      }
                      className="text-[10px]"
                    >
                      {Array.isArray(f.status) ? f.status.join(', ') : f.status || '-'}
                    </Badge>
                    <div className="text-[10px] text-primary font-semibold">{f.funnelStage}</div>
                  </td>
                  <td className="p-3">
                    <Select
                      value={typeof currentPriority === 'string' ? currentPriority : ''}
                      onValueChange={(v: string) =>
                        setEditValues((p) => ({ ...p, [f.id]: { ...p[f.id], priority: v as any } }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">Alta (Verde)</SelectItem>
                        <SelectItem value="Medium">Média (Amarelo)</SelectItem>
                        <SelectItem value="Low">Baixa (Vermelho)</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={currentProb}
                      onChange={(e) =>
                        setEditValues((p) => ({
                          ...p,
                          [f.id]: { ...p[f.id], winProbability: e.target.value },
                        }))
                      }
                      className="h-8 w-20 text-xs"
                    />
                  </td>
                  <td className="p-3 font-semibold text-primary">
                    {formatCurrency(f.potentialValue)}
                  </td>
                  <td className="p-3">
                    <Select
                      value={typeof currentOwner === 'string' ? currentOwner : ''}
                      onValueChange={(v) =>
                        setEditValues((p) => ({ ...p, [f.id]: { ...p[f.id], salesOwner: v } }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Atribuir" />
                      </SelectTrigger>
                      <SelectContent>
                        {sellers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name || s.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 min-w-[200px]">
                    <Input
                      value={currentNextStep}
                      placeholder="Descreva a ação / abordagem..."
                      onChange={(e) =>
                        setEditValues((p) => ({
                          ...p,
                          [f.id]: { ...p[f.id], suggested_approach: e.target.value },
                        }))
                      }
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-3 text-center">
                    {hasEdits && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleInlineSave(f.id)}
                        className="h-7 w-7 p-0 shadow-sm"
                        title="Salvar alterações"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center p-8 text-muted-foreground">
                  Nenhum registro encontrado com os filtros selecionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
