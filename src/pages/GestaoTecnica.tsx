import { useState, useEffect, useMemo } from 'react'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useAppContext } from '@/store/AppContext'
import { updateFactoryPB } from '@/services/factories'
import { getUsers, type UserListItem } from '@/services/users'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { MapPin, UserCog, Loader2 } from 'lucide-react'

export default function GestaoTecnica() {
  const factories = useScopedFactories()
  const { updateFactory } = useAppContext()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)

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

  const grouped = useMemo(() => {
    const map = new Map<string, typeof factories>()
    factories.forEach((f) => {
      const species = f.animalSpecies || 'Multiespécie'
      if (!map.has(species)) map.set(species, [])
      map.get(species)!.push(f)
    })
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [factories])

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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão Técnica por Espécie</h1>
        <p className="text-muted-foreground text-sm">
          Atribua gestores técnicos (vendedores) às fábricas agrupadas por espécie animal.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {grouped.map(([species, facs]) => (
          <Card key={species} className="shadow-subtle p-4 text-center">
            <div className="text-2xl font-bold text-primary">{facs.length}</div>
            <div className="text-xs text-muted-foreground">{species}</div>
          </Card>
        ))}
      </div>

      <Accordion type="multiple" defaultValue={grouped.length > 0 ? [grouped[0][0]] : []}>
        {grouped.map(([species, facs]) => (
          <AccordionItem key={species} value={species}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-lg font-bold flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-primary" />
                  {species}
                </span>
                <span className="text-sm text-muted-foreground">{facs.length} fábricas</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {facs.map((f) => (
                  <Card
                    key={f.id}
                    className="shadow-subtle p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate">{f.name}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {[f.city, f.state, f.country].filter(Boolean).join(', ') || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {f.status}
                        </Badge>
                        <span className="text-xs text-primary font-medium">
                          {formatCurrency(f.potentialValue)}
                        </span>
                        {f.salesOwnerName && (
                          <span className="text-xs text-muted-foreground">
                            • {f.salesOwnerName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 w-[200px]">
                      <Select
                        value={f.salesOwner || ''}
                        onValueChange={(v) => handleAssign(f.id, v)}
                      >
                        <SelectTrigger className="h-9">
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
