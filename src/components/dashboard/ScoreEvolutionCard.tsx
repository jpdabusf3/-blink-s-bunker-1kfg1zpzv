import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { useAppContext } from '@/store/AppContext'

export function ScoreEvolutionCard({
  regionFilter = 'Todas as Regiões',
}: {
  regionFilter?: string
}) {
  const { factories } = useAppContext()

  const filteredFactories =
    regionFilter === 'Todas as Regiões'
      ? factories
      : factories.filter((f) => f.region === regionFilter)

  const [selectedId, setSelectedId] = useState(filteredFactories[0]?.id)

  useEffect(() => {
    if (filteredFactories.length > 0 && !filteredFactories.find((f) => f.id === selectedId)) {
      setSelectedId(filteredFactories[0].id)
    }
  }, [regionFilter, filteredFactories, selectedId])

  const factory = factories.find((f) => f.id === selectedId)
  const data = factory?.scoreHistory || []

  return (
    <Card className="shadow-subtle print:break-inside-avoid print:col-span-2 print:shadow-none print:border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Evolução de Score</CardTitle>
          <span className="hidden print:block text-sm text-muted-foreground mt-1 font-medium">
            {factory?.name}
          </span>
        </div>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[180px] h-8 text-xs print:hidden">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {filteredFactories.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ChartContainer
          config={{ score: { label: 'Score Total', color: 'hsl(var(--primary))' } }}
          className="h-full w-full"
        >
          <LineChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { month: 'short' })}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => new Date(v).toLocaleDateString('pt-BR')}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
