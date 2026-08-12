import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { normalizeArray } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { useAppContext } from '@/store/AppContext'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--chart-2))',
]

export function FactoriesBySpeciesCard({
  regionFilter = 'Todas as Regiões',
}: {
  regionFilter?: string
}) {
  const { factories } = useAppContext()

  const data = useMemo(() => {
    const filtered =
      regionFilter === 'Todas as Regiões'
        ? factories
        : factories.filter((f) => f.region === regionFilter || f.stateRegion === regionFilter)

    const map = new Map<string, number>()
    filtered.forEach((f) => {
      const speciesArr = normalizeArray(f.animalSpecies)
      if (speciesArr.length === 0) {
        map.set('Não informado', (map.get('Não informado') || 0) + 1)
      } else {
        speciesArr.forEach((sp) => {
          map.set(sp, (map.get(sp) || 0) + 1)
        })
      }
    })

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [factories, regionFilter])

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Fábricas por Espécie Animal</CardTitle>
        <CardDescription>Distribuição por tipo de criação</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ChartContainer
          config={{ value: { label: 'Fábricas', color: 'hsl(var(--primary))' } }}
          className="h-full w-full"
        >
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
