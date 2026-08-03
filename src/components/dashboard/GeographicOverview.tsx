import { useState, useMemo } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useRealtime } from '@/hooks/use-realtime'
import { Card } from '@/components/ui/card'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { GeographicFactoryCard } from '@/components/dashboard/GeographicFactoryCard'
import { getContinent } from '@/lib/continent-mapping'
import { formatCompactCurrency } from '@/lib/utils'
import { Globe2, Building2, DollarSign, Factory as FactoryIcon } from 'lucide-react'
import type { Factory } from '@/types'

export function GeographicOverview() {
  const { factories } = useAppContext()
  const [, setTick] = useState(0)

  useRealtime('factories', () => setTick((t) => t + 1))

  const continentGroups = useMemo(() => {
    const continentMap = new Map<string, Map<string, Factory[]>>()
    factories.forEach((f) => {
      const continent = getContinent(f.country || 'Outro')
      const country = f.country || 'Não informado'
      if (!continentMap.has(continent)) continentMap.set(continent, new Map())
      const countryMap = continentMap.get(continent)!
      if (!countryMap.has(country)) countryMap.set(country, [])
      countryMap.get(country)!.push(f)
    })

    return Array.from(continentMap.entries())
      .map(([continentName, countryMap]) => {
        const countries = Array.from(countryMap.entries())
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
          countries,
          factories: countries.flatMap((c) => c.factories),
          potential: countries.reduce((s, c) => s + c.potential, 0),
          capacity: countries.reduce((s, c) => s + c.capacity, 0),
        }
      })
      .sort((a, b) => b.potential - a.potential)
  }, [factories])

  const globalMetrics = useMemo(() => {
    const countries = new Set(factories.map((f) => f.country || 'Não informado'))
    return {
      continents: continentGroups.length,
      countries: countries.size,
      total: factories.length,
      potential: factories.reduce((s, f) => s + f.potentialValue, 0),
    }
  }, [factories, continentGroups])

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

  return (
    <div className="space-y-6 animate-fade-in">
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
