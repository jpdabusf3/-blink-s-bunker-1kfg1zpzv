import { useAppContext } from '@/store/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Index() {
  const { factories } = useAppContext()

  const metrics = {
    revenue: factories.reduce((s, f) => s + f.potentialValue, 0),
    weighted: factories.reduce((s, f) => s + f.potentialValue * (f.winProbability / 100), 0),
    active: factories.filter((f) => f.status === 'Atendido').length,
    prospect: factories.filter((f) => f.status === 'Prospeção').length,
  }

  const topFactories = [...factories]
    .sort((a, b) => b.potentialValue - a.potentialValue)
    .slice(0, 5)
  const topVolume = [...factories]
    .sort((a, b) => b.capacity - a.capacity)
    .slice(0, 10)
    .map((f) => ({ name: f.name.substring(0, 15), value: f.capacity }))

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

  const productData = ['Adsorventes', 'Prebióticos', 'Minerais Orgânicos', 'Blends', 'Ingredientes']
    .map((line) => ({
      name: line,
      value: factories
        .filter((f) => f.productLineAffinity === line)
        .reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ]

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral MT</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-2 print:hidden shadow-sm"
        >
          <Download className="w-4 h-4" /> Exportar Relatório PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Fábricas Mapeadas', val: factories.length },
          { title: 'Ativas / Prospecção', val: `${metrics.active} / ${metrics.prospect}` },
          {
            title: 'Receita Potencial',
            val: formatCurrency(metrics.revenue),
            color: 'text-primary',
          },
          {
            title: 'Forecast Ponderado',
            val: formatCurrency(metrics.weighted),
            color: 'text-accent',
          },
        ].map((kpi) => (
          <Card key={kpi.title} className="shadow-subtle">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${kpi.color || ''}`}>{kpi.val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                />
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
            <CardTitle>Top 10 Volume (t/mês)</CardTitle>
            <CardDescription>Maiores capacidades produtivas</CardDescription>
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
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--chart-3))"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>Ranking Linhas de Produto</CardTitle>
            <CardDescription>Receita por tendência de linha Blink</CardDescription>
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
                <Tooltip
                  content={<ChartTooltipContent />}
                  cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                />
                <Bar
                  dataKey="value"
                  fill="hsl(var(--chart-4))"
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:break-inside-avoid">
        <Card className="lg:col-span-2 shadow-subtle overflow-hidden">
          <CardHeader>
            <CardTitle>Top 5 Oportunidades</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fábrica</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead className="text-right">Potencial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topFactories.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.region}</TableCell>
                    <TableCell>{f.funnelStage}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatCurrency(f.potentialValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>Highlights Estratégicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-primary">Forças Frequentes</h4>
                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                  {topFactories
                    .slice(0, 3)
                    .map((f) => f.swot.strengths && <li key={f.id}>{f.swot.strengths}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-accent">Oportunidades</h4>
                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1">
                  {topFactories
                    .slice(0, 3)
                    .map((f) => f.swot.opportunities && <li key={f.id}>{f.swot.opportunities}</li>)}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
