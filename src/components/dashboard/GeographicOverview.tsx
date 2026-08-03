import { useState, useMemo } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useRealtime } from '@/hooks/use-realtime'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { GeographicFactoryCard } from '@/components/dashboard/GeographicFactoryCard'
import { getContinent } from '@/lib/continent-mapping'
import { formatCompactCurrency } from '@/lib/utils'
import { exportGeographicReport } from '@/lib/exportReports'
import { Globe2, Building2, DollarSign, Factory as FactoryIcon, Download } from 'lucide-react'
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
const CHANNELS = ['Direct', 'Indirect']
const STATUSES = ['Atendido', 'Não atendido', 'Prospeção']
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

export function GeographicOverview() {
  const { factories } = useAppContext()
  const [, setTick] = useState(0)
  const [filters, setFilters] = useState({
    country: 'all',
    continent: 'all',
    region: 'all',
    species: 'all',
    channel: 'all',
    status: 'all',
  })

  useRealtime('factories', () => setTick((t) => t + 1))

  const countries = useMemo(
    () => Array.from(new Set(factories.map((f) => f.country).filter(Boolean))),
    [factories],
  )
  const continents = useMemo(
    () => Array.from(new Set(countries.map((c) => getContinent(c)))),
    [countries],
  )

  const filtered = useMemo(
    () =>
      factories.filter((f) => {
        if (filters.country !== 'all' && f.country !== filters.country) return false
        if (filters.continent !== 'all' && getContinent(f.country || '') !== filters.continent)
          return false
        if (filters.region !== 'all' && f.stateRegion !== filters.region) return false
        if (filters.species !== 'all' && f.animalSpecies !== filters.species) return false
        if (filters.channel !== 'all' && f.salesChannel !== filters.channel) return false
        if (filters.status !== 'all' && f.status !== filters.status) return false
        return true
      }),
    [factories, filters],
  )

  const continentGroups = useMemo(() => {
    const continentMap = new Map<string, Map<string, Factory[]>>()
    filtered.forEach((f) => {
      const continent = getContinent(f.country || 'Outro')
      const country = f.country || 'Não informado'
      if (!continentMap.has(continent)) continentMap.set(continent, new Map())
      const countryMap = continentMap.get(continent)!
      if (!countryMap.has(country)) countryMap.set(country, [])
      countryMap.get(country)!.push(f)
    })

    return Array.from(continentMap.entries())
      .map(([continentName, countryMap]) => {
        const countriesArr = Array.from(countryMap.entries())
          .map(([countryName, facs]) => ({
            name: countryName,
            factories: facs,
            potential: facs.reduce((s, f) => s + f.potentialValue, 0),
            capacity: facs.reduce((s, f) => s + (f.capacity || 0), 0),
            active: facs.filter((f) => f.status === 'Atendido').length,
          }))
          .sort((a, b) => b.potential - a.potential)

        return {
          name: continentName,
          countries: countriesArr,
          factories: countriesArr.flatMap((c) => c.factories),
          potential: countriesArr.reduce((s, c) => s + c.potential, 0),
          capacity: countriesArr.reduce((s, c) => s + c.capacity, 0),
        }
      })
      .sort((a, b) => b.potential - a.potential)
  }, [filtered])

  const globalMetrics = useMemo(
    () => ({
      continents: continentGroups.length,
      countries: new Set(filtered.map((f) => f.country || 'Não informado')).size,
      total: filtered.length,
      potential: filtered.reduce((s, f) => s + f.potentialValue, 0),
    }),
    [filtered, continentGroups],
  )

  const metricCards = [
    { label: 'Continentes', value: globalMetrics.continents, icon: Globe2 },
    { label: 'Países', value: globalMetrics.countries, icon: Building2 },
    { label: 'Fábricas', value: globalMetrics.total, icon: FactoryIcon },
    {
      label: 'Receita Potencial',
      value: formatCompactCurrency(globalMetrics.potential),
      icon: DollarSign,
    },
  ]

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
        <SelectItem value="all">Todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Visão Geográfica</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportGeographicReport(filtered)}
          className="gap-2"
        >
          <Download className="w-4 h-4" /> Exportar Relatório
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FSelect
          label="Continente"
          value={filters.continent}
          onChange={(v) => setFilters((p) => ({ ...p, continent: v }))}
          options={continents}
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
        <FSelect
          label="Espécie"
          value={filters.species}
          onChange={(v) => setFilters((p) => ({ ...p, species: v }))}
          options={SPECIES}
        />
        <FSelect
          label="Canal"
          value={filters.channel}
          onChange={(v) => setFilters((p) => ({ ...p, channel: v }))}
          options={CHANNELS}
        />
        <FSelect
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
          options={STATUSES}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricCards.map((m) => (
          <Card
            key={m.label}
            className="shadow-subtle text-center flex flex-col justify-center items-center p-4"
          >
            <m.icon className="w-5 h-5 text-primary mb-1" />
            <div className="text-xl sm:text-2xl font-bold">{m.value}</div>
            <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground">{m.label}</h3>
          </Card>
        ))}
      </div>

      <Accordion
        type="multiple"
        defaultValue={continentGroups.length > 0 ? [continentGroups[0].name] : []}
      >
        {continentGroups.map((continent) => (
          <AccordionItem key={continent.name} value={continent.name}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <span className="text-lg font-bold flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-primary" />
                  {continent.name}
                </span>
                <div className="flex gap-4 text-sm font-normal text-muted-foreground">
                  <span>{continent.countries.length} países</span>
                  <span>{continent.factories.length} fábricas</span>
                  <span className="text-primary font-semibold">
                    {formatCompactCurrency(continent.potential)}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {continent.countries.map((country) => (
                <div key={country.name} className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2 flex-wrap gap-2">
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {country.name}
                    </h4>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{country.factories.length} fábricas</span>
                      <span className="text-primary font-semibold">
                        {formatCompactCurrency(country.potential)}
                      </span>
                      <span>{country.active} ativas</span>
                      {country.capacity > 0 && (
                        <span>Cap: {country.capacity.toLocaleString('pt-BR')}t</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {country.factories.map((f) => (
                      <GeographicFactoryCard key={f.id} factory={f} />
                    ))}
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
