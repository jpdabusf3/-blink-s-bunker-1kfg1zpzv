import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import { useAppContext } from '@/store/AppContext'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function DashboardCharts() {
  const { factories } = useAppContext()

  const funnelData = [
    'Lead',
    'Primeiro Contato',
    'Diagnóstico Técnico',
    'Apresentação',
    'Teste/Trial',
    'Proposta',
    'Negociação',
    'Fechamento',
  ]
    .map((stage) => ({
      stage: stage.split(' ')[0],
      value: factories
        .filter((f) => f.funnelStage === stage)
        .reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)

  const regionData = ['Norte', 'Sul', 'Leste', 'Oeste', 'Médio-Norte']
    .map((region) => ({
      name: region,
      value: factories.filter((f) => f.region === region).reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)

  const topVolume = [...factories]
    .sort((a, b) => b.capacity - a.capacity)
    .slice(0, 5)
    .map((f) => ({ name: f.name.substring(0, 15), value: f.capacity }))

  const productData = ['Adsorventes', 'Prebióticos', 'Minerais Orgânicos', 'Blends', 'Ingredientes']
    .map((line) => ({
      name: line,
      value: factories
        .filter((f) => f.productLineAffinity === line)
        .reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Funil de Vendas</CardTitle>
          <CardDescription>Valor por estágio</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Valor (R$)', color: 'hsl(var(--primary))' } }}
            className="h-full w-full"
          >
            <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="stage"
                type="category"
                width={90}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Distribuição Regional</CardTitle>
          <CardDescription>Potencial financeiro</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Valor', color: 'hsl(var(--primary))' } }}
            className="h-full w-full"
          >
            <PieChart>
              <Pie
                data={regionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {regionData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Top Volume (t/mês)</CardTitle>
          <CardDescription>Maiores capacidades</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Capacidade', color: 'hsl(var(--chart-3))' } }}
            className="h-full w-full"
          >
            <BarChart data={topVolume} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
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

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Ranking Linhas de Produto</CardTitle>
          <CardDescription>Receita por tendência</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Receita (R$)', color: 'hsl(var(--chart-4))' } }}
            className="h-full w-full"
          >
            <BarChart data={productData} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
