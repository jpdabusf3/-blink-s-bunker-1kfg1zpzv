import { useState, useEffect, useMemo } from 'react'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useAppContext } from '@/store/AppContext'
import { updateFactoryPB } from '@/services/factories'
import { getUsers, type UserListItem } from '@/services/users'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { formatCurrency } from '@/lib/utils'
import { MapPin, UserCog, Loader2, Search, CheckCircle2 } from 'lucide-react'
import { UserFilter } from '@/components/UserFilter'

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

export default function GestaoTecnica() {
  const factories = useScopedFactories()
  const { updateFactory } = useAppContext()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false))
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

  const filteredFactories = useMemo(() => {
    return factories.filter((f) => {
      if (
        selectedRegion !== 'all' &&
        f.stateRegion !== selectedRegion &&
        f.region !== selectedRegion
      ) {
        return false
      }
      if (salesOwnerFilter !== 'all' && f.salesOwner !== salesOwnerFilter) return false
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const nameMatch = f.name.toLowerCase().includes(q)
        const cityMatch = f.city?.toLowerCase().includes(q)
        const ownerMatch = f.salesOwnerName?.toLowerCase().includes(q)
        if (!nameMatch && !cityMatch && !ownerMatch) return false
      }
      return true
    })
  }, [factories, selectedRegion, searchTerm, salesOwnerFilter])

  const groupedBySpecies = useMemo(() => {
    const map = new Map<string, typeof factories>()
    filteredFactories.forEach((f) => {
      const species = f.animalSpecies || 'Multiespécie'
      if (!map.has(species)) map.set(species, [])
      map.get(species)!.push(f)
    })
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [filteredFactories])

  const getOwnerName = (id?: string) => users.find((u) => u.id === id)?.name || ''

  const handleAssign = async (factoryId: string, userId: string) => {
    const ownerName = getOwnerName(userId)
    updateFactory(factoryId, { salesOwner: userId, salesOwnerName: ownerName })
    try {
      await updateFactoryPB(factoryId, { salesOwner: userId } as any)
    } catch {
      /* noop */
    }
  }

  const handleBatchAssignSpecies = async (speciesFacs: typeof factories, userId: string) => {
    if (!userId) return
    const ownerName = getOwnerName(userId)
    for (const f of speciesFacs) {
      updateFactory(f.id, { salesOwner: userId, salesOwnerName: ownerName })
      try {
        await updateFactoryPB(f.id, { salesOwner: userId } as any)
      } catch {
        /* noop */
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão Técnica por Espécie e Região</h1>
          <p className="text-muted-foreground text-sm">
            Distribua carteiras de clientes atribuindo Gestores Técnicos (Vendedores) por espécie e
            área geográfica.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar fábrica ou gestor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Regiões</SelectItem>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <UserFilter
            value={salesOwnerFilter}
            onChange={setSalesOwnerFilter}
            className="w-[180px] h-9 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {groupedBySpecies.map(([species, facs]) => {
          const assignedCount = facs.filter((f) => f.salesOwner).length
          return (
            <Card
              key={species}
              className="shadow-subtle p-4 text-center border-l-4 border-l-primary"
            >
              <div className="text-2xl font-bold text-primary">{facs.length}</div>
              <div className="text-xs font-semibold text-foreground mt-0.5">{species}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {assignedCount} de {facs.length} atribuídos
              </div>
            </Card>
          )
        })}
      </div>

      <Accordion
        type="multiple"
        defaultValue={groupedBySpecies.length > 0 ? [groupedBySpecies[0][0]] : []}
      >
        {groupedBySpecies.map(([species, facs]) => (
          <AccordionItem
            key={species}
            value={species}
            className="border rounded-xl px-4 bg-card mb-3"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <UserCog className="w-5 h-5 text-primary" />
                  {species}
                </span>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant="outline" className="font-mono">
                    {facs.length} fábrica(s)
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border text-xs flex-wrap gap-2">
                <span className="font-semibold text-foreground">
                  Atribuição em lote para todas as fábricas de {species}:
                </span>
                <div className="flex items-center gap-2">
                  <Select onValueChange={(v) => handleBatchAssignSpecies(facs, v)}>
                    <SelectTrigger className="h-8 w-[200px] text-xs bg-background">
                      <SelectValue placeholder="Atribuir toda espécie..." />
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {facs.map((f) => (
                  <Card
                    key={f.id}
                    className="shadow-subtle p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm truncate">{f.name}</h4>
                        {f.salesOwner && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        {[f.city, f.state || f.stateRegion, f.country].filter(Boolean).join(', ') ||
                          'N/A'}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {f.profile_type || f.status}
                        </Badge>
                        <span className="text-xs text-primary font-bold">
                          {formatCurrency(f.potentialValue)}
                        </span>
                        {f.salesOwnerName && (
                          <span className="text-xs text-muted-foreground font-medium truncate">
                            • {f.salesOwnerName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 w-full sm:w-[200px]">
                      <Select
                        value={f.salesOwner || ''}
                        onValueChange={(v) => handleAssign(f.id, v)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Atribuir Gestor" />
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
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
