import { useState, useEffect, useMemo } from 'react'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useAppContext } from '@/store/AppContext'
import { updateFactoryPB } from '@/services/factories'
import { getUsers, type UserListItem } from '@/services/users'
import { logActivity } from '@/services/activity-logs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { MapPin, UserCog, Loader2, Search, CheckCircle2, UserCheck } from 'lucide-react'
import { UserFilter } from '@/components/UserFilter'
import { toast } from 'sonner'

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

  const getUserName = (id?: string) => users.find((u) => u.id === id)?.name || ''

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
        const techMatch = f.technicalManagerName?.toLowerCase().includes(q)
        if (!nameMatch && !cityMatch && !ownerMatch && !techMatch) return false
      }
      return true
    })
  }, [factories, selectedRegion, searchTerm, salesOwnerFilter])

  const groupedBySpecies = useMemo(() => {
    const map = new Map<string, typeof factories>()
    filteredFactories.forEach((f) => {
      const species = f.animalSpecies || 'Multi espécie'
      if (!map.has(species)) map.set(species, [])
      map.get(species)!.push(f)
    })
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [filteredFactories])

  const handleAssignTechnicalManager = async (factoryId: string, userId: string) => {
    const targetUserId = userId === 'none' ? '' : userId
    const managerName = getUserName(targetUserId)
    updateFactory(factoryId, { technicalManager: targetUserId, technicalManagerName: managerName })
    try {
      await updateFactoryPB(factoryId, { technicalManager: targetUserId } as any)
      logActivity(
        'Atribuição de Gestor Técnico',
        `Gestor Técnico ${managerName || 'Removido'} atribuído à fábrica`,
        factoryId,
        'factories',
      ).catch(() => {})
      toast.success('Gestor Técnico atualizado')
    } catch {
      toast.error('Erro ao atualizar Gestor Técnico')
    }
  }

  const handleAssignSalesOwner = async (factoryId: string, userId: string) => {
    const targetUserId = userId === 'none' ? '' : userId
    const ownerName = getUserName(targetUserId)
    updateFactory(factoryId, { salesOwner: targetUserId, salesOwnerName: ownerName })
    try {
      await updateFactoryPB(factoryId, { salesOwner: targetUserId } as any)
      logActivity(
        'Atribuição de Vendedor',
        `Vendedor ${ownerName || 'Removido'} atribuído à fábrica`,
        factoryId,
        'factories',
      ).catch(() => {})
      toast.success('Vendedor atualizado')
    } catch {
      toast.error('Erro ao atualizar Vendedor')
    }
  }

  const handleBatchAssignTech = async (speciesFacs: typeof factories, userId: string) => {
    if (!userId || userId === 'none') return
    const managerName = getUserName(userId)
    for (const f of speciesFacs) {
      updateFactory(f.id, { technicalManager: userId, technicalManagerName: managerName })
      try {
        await updateFactoryPB(f.id, { technicalManager: userId } as any)
        logActivity(
          'Atribuição em Lote de Gestor Técnico',
          `Gestor Técnico ${managerName} atribuído em lote (${f.animalSpecies})`,
          f.id,
          'factories',
        ).catch(() => {})
      } catch {
        /* noop */
      }
    }
    toast.success(`Gestor Técnico atribuído para ${speciesFacs.length} fábrica(s)`)
  }

  const handleBatchAssignSales = async (speciesFacs: typeof factories, userId: string) => {
    if (!userId || userId === 'none') return
    const ownerName = getUserName(userId)
    for (const f of speciesFacs) {
      updateFactory(f.id, { salesOwner: userId, salesOwnerName: ownerName })
      try {
        await updateFactoryPB(f.id, { salesOwner: userId } as any)
        logActivity(
          'Atribuição em Lote de Vendedor',
          `Vendedor ${ownerName} atribuído em lote (${f.animalSpecies})`,
          f.id,
          'factories',
        ).catch(() => {})
      } catch {
        /* noop */
      }
    }
    toast.success(`Vendedor atribuído para ${speciesFacs.length} fábrica(s)`)
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
          <h1 className="text-2xl font-bold tracking-tight">
            Gestão Técnica e Comercial por Espécie
          </h1>
          <p className="text-muted-foreground text-sm">
            Atribua Gestores Técnicos e Vendedores Responsáveis por espécie animal e área
            geográfica.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar fábrica ou gestor/vendedor..."
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
          const assignedCount = facs.filter((f) => f.salesOwner || f.technicalManager).length
          return (
            <Card
              key={species}
              className="shadow-subtle p-4 text-center border-l-4 border-l-primary"
            >
              <div className="text-2xl font-bold text-primary">{facs.length}</div>
              <div className="text-xs font-semibold text-foreground mt-0.5">{species}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {assignedCount} de {facs.length} com responsável
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
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border text-xs flex-wrap gap-3">
                <span className="font-semibold text-foreground">
                  Atribuição em lote para todas as fábricas de {species}:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select onValueChange={(v) => handleBatchAssignTech(facs, v)}>
                    <SelectTrigger className="h-8 w-[190px] text-xs bg-background">
                      <SelectValue placeholder="Lote: Gestor Técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select onValueChange={(v) => handleBatchAssignSales(facs, v)}>
                    <SelectTrigger className="h-8 w-[190px] text-xs bg-background">
                      <SelectValue placeholder="Lote: Vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
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
                    className="shadow-subtle p-4 flex flex-col items-start justify-between gap-3 border"
                  >
                    <div className="w-full flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm truncate">{f.name}</h4>
                          {(f.salesOwner || f.technicalManager) && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          {[f.city, f.state || f.stateRegion, f.country]
                            .filter(Boolean)
                            .join(', ') || 'N/A'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {f.profile_type || f.status}
                      </Badge>
                    </div>

                    <div className="w-full flex items-center justify-between text-xs pt-1 border-t">
                      <span className="font-bold text-primary">
                        {formatCurrency(f.potentialValue)}
                      </span>
                      <span className="text-muted-foreground">{f.capacity} t/mês</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-1">
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <UserCog className="w-3 h-3 text-primary" />
                          Gestor Técnico:
                        </span>
                        <Select
                          value={f.technicalManager || 'none'}
                          onValueChange={(v) => handleAssignTechnicalManager(f.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Atribuir Técnico" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name || u.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-emerald-600" />
                          Vendedor:
                        </span>
                        <Select
                          value={f.salesOwner || 'none'}
                          onValueChange={(v) => handleAssignSalesOwner(f.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Atribuir Vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum / Não atribuído</SelectItem>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name || u.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
