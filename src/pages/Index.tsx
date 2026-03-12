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

  const totalRevenue = factories.reduce((sum, f) => sum + f.potentialValue, 0)
  const weightedRevenue = factories.reduce(
    (sum, f) => sum + f.potentialValue * (f.winProbability / 100),
    0,
  )
  const activeCount = factories.filter((f) => f.status === 'Atendido').length
  const prospectCount = factories.filter((f) => f.status === 'Prospeção').length

  const topFactories = [...factories]
    .sort((a, b) => b.potentialValue - a.potentialValue)
    .slice(0, 5)

  const stages = [
    'Lead',
    'Primeiro Contato',
    'Diagnóstico Técnico',
    'Apresentação',
    'Teste/Trial',
    'Proposta',
    'Negociação',
    'Fechamento',
  ]
  const funnelData = stages
    .map((stage) => {
      const val = factories
        .filter((f) => f.funnelStage === stage)
        .reduce((s, f) => s + f.potentialValue, 0)
      return { stage: stage.split(' ')[0], value: val }
    })
    .filter((d) => d.value > 0)

  const regionData = ['Norte', 'Sul', 'Leste', 'Oeste', 'Médio-Norte']
    .map((region) => ({
      name: region,
      value: factories.filter((f) => f.region === region).reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)

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
        <Card className="shadow-subtle">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fábricas Mapeadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{factories.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ativas / Prospecção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {activeCount} <span className="text-muted-foreground text-xl">/ {prospectCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Potencial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Forecast Ponderado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{formatCurrency(weightedRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
            <CardDescription>Valor acumulado por estágio</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
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
            <CardDescription>Potencial financeiro por território</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
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
                  {regionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent />} />
              </PieChart>
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
