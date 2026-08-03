import { useState, useMemo } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { updateFactoryPB } from '@/services/factories'
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
import { Save } from 'lucide-react'
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchPriority, setBatchPriority] = useState('')
  const [batchProb, setBatchProb] = useState('')
  const [filters, setFilters] = useState({
    species: 'all',
    status: 'all',
    stage: 'all',
    country: 'all',
    region: 'all',
  })
  const [editValues, setEditValues] = useState<
    Record<string, { priority?: string; winProbability?: string }>
  >({})

  const countries = useMemo(
    () => Array.from(new Set(factories.map((f) => f.country).filter(Boolean))),
    [factories],
  )

  const filtered = useMemo(
    () =>
      factories.filter((f) => {
        if (filters.species !== 'all' && f.animalSpecies !== filters.species) return false
        if (filters.status !== 'all' && f.status !== filters.status) return false
        if (filters.stage !== 'all' && f.funnelStage !== filters.stage) return false
        if (filters.country !== 'all' && f.country !== filters.country) return false
        if (filters.region !== 'all' && f.stateRegion !== filters.region) return false
        return true
      }),
    [factories, filters],
  )

  const isNewLead = (f: Factory) => {
    if (['Lead', 'Primeiro Contato'].includes(f.funnelStage)) return true
    if (f.created) {
      const created = new Date(f.created)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return created > thirtyDaysAgo
    }
    return false
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
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
    const data: Partial<Factory> = {}
    if (edits.priority) data.priority = edits.priority as Factory['priority']
    if (edits.winProbability !== undefined) data.winProbability = Number(edits.winProbability)
    if (Object.keys(data).length > 0) {
      updateFactory(id, data)
      try {
        await updateFactoryPB(id, data)
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
    if (batchProb) data.winProbability = Number(batchProb)
    if (Object.keys(data).length === 0) return
    for (const id of selected) {
      updateFactory(id, data)
      try {
        await updateFactoryPB(id, data)
      } catch {
        /* noop */
      }
    }
    setSelected(new Set())
    setBatchPriority('')
    setBatchProb('')
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
      <SelectTrigger className="w-full md:w-[150px] bg-background">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas</SelectItem>
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
      <div className="flex flex-wrap gap-2">
        <FSelect
          label="Espécie"
          value={filters.species}
          onChange={(v) => setFilters((p) => ({ ...p, species: v }))}
          options={SPECIES}
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
      </div>

      {selected.size > 0 && (
        <Card className="p-3 flex flex-wrap items-center gap-2 bg-primary/5 border-primary/20">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <Select value={batchPriority} onValueChange={setBatchPriority}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="High">Alta</SelectItem>
              <SelectItem value="Medium">Média</SelectItem>
              <SelectItem value="Low">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="Prob. %"
            value={batchProb}
            onChange={(e) => setBatchProb(e.target.value)}
            className="w-[100px]"
          />
          <Button size="sm" onClick={handleBatchUpdate} className="gap-1">
            <Save className="w-4 h-4" /> Aplicar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Limpar
          </Button>
        </Card>
      )}

      <div className="overflow-x-auto bg-card border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-2 text-left">
                <Checkbox
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="p-2 text-left font-medium">Fábrica</th>
              <th className="p-2 text-left font-medium">Espécie</th>
              <th className="p-2 text-left font-medium">Status</th>
              <th className="p-2 text-left font-medium">Estágio</th>
              <th className="p-2 text-left font-medium">Prioridade</th>
              <th className="p-2 text-left font-medium">Prob. (%)</th>
              <th className="p-2 text-left font-medium">Potencial</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const isNew = isNewLead(f)
              const edits = editValues[f.id] || {}
              return (
                <tr
                  key={f.id}
                  className={`border-b hover:bg-muted/30 ${isNew ? 'bg-primary/5' : ''}`}
                >
                  <td className="p-2">
                    <Checkbox
                      checked={selected.has(f.id)}
                      onCheckedChange={() => toggleSelect(f.id)}
                    />
                  </td>
                  <td className="p-2 font-medium">
                    <div className="flex items-center gap-1">
                      {f.name}
                      {isNew && (
                        <Badge className="text-[10px] bg-primary/20 text-primary">Novo</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {f.city} • {f.country || 'Brasil'}
                    </div>
                  </td>
                  <td className="p-2">{f.animalSpecies || '-'}</td>
                  <td className="p-2">{f.status}</td>
                  <td className="p-2 text-xs">{f.funnelStage}</td>
                  <td className="p-2">
                    <Select
                      value={edits.priority ?? f.priority ?? 'Medium'}
                      onValueChange={(v) =>
                        setEditValues((p) => ({ ...p, [f.id]: { ...p[f.id], priority: v } }))
                      }
                    >
                      <SelectTrigger className="h-8 w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">Alta</SelectItem>
                        <SelectItem value="Medium">Média</SelectItem>
                        <SelectItem value="Low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={edits.winProbability ?? f.winProbability}
                      onChange={(e) =>
                        setEditValues((p) => ({
                          ...p,
                          [f.id]: { ...p[f.id], winProbability: e.target.value },
                        }))
                      }
                      className="h-8 w-[70px]"
                    />
                  </td>
                  <td className="p-2 text-xs">{formatCurrency(f.potentialValue)}</td>
                  <td className="p-2">
                    {(edits.priority || edits.winProbability !== undefined) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleInlineSave(f.id)}
                        className="h-7 px-2"
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center p-8 text-muted-foreground">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
