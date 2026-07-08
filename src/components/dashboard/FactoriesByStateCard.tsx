import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { useAppContext } from '@/store/AppContext'

export function FactoriesByStateCard({
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
      const state = f.state || 'Não informado'
      map.set(state, (map.get(state) || 0) + 1)
    })

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [factories, regionFilter])

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Fábricas por Estado</CardTitle>
        <CardDescription>Distribuição geográfica por UF</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ChartContainer
          config={{ value: { label: 'Fábricas', color: 'hsl(var(--chart-3))' } }}
          className="h-full w-full"
        >
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={60}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
