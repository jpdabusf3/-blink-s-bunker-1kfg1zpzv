import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import {
  getTeamPerformance,
  type TeamPerformance as TeamPerfData,
} from '@/services/team-performance'
import { useRealtime } from '@/hooks/use-realtime'
import { Loader2, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function TeamPerformanceDashboard() {
  const [data, setData] = useState<TeamPerfData | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const loadData = async () => {
    try {
      const result = await getTeamPerformance(startDate, endDate)
      setData(result)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  useRealtime('activity_logs', loadData)

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!data || data.totalLogs === 0) {
    return (
      <Card className="shadow-subtle">
        <CardContent className="text-center py-12 text-muted-foreground">
          Nenhuma atividade registrada no período selecionado.
        </CardContent>
      </Card>
    )
  }

  const topUsers = data.actionsPerUser.slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-end p-4 rounded-lg border bg-muted/30">
        <div className="sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Data Inicial</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="sm:w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Data Final</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Ações por Usuário
            </CardTitle>
            <CardDescription>Total de atividades por membro da equipe</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer
              config={{ actions: { label: 'Ações', color: 'hsl(var(--primary))' } }}
              className="h-full w-full"
            >
              <BarChart data={topUsers} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  dataKey="user"
                  type="category"
                  width={100}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="actions"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-primary" /> Distribuição de Ações
            </CardTitle>
            <CardDescription>Tipos de atividades registradas</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer
              config={{ value: { label: 'Quantidade', color: 'hsl(var(--primary))' } }}
              className="h-full w-full"
            >
              <PieChart>
                <Pie
                  data={data.actionTypeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.actionTypeDistribution.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Ranking de Produtividade</CardTitle>
          <CardDescription>{data.totalLogs} atividades registradas no total</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.actionsPerUser.slice(0, 5).map((u, idx) => (
              <div
                key={u.email}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">{idx + 1}º</span>
                  <div>
                    <div className="font-medium">{u.user}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </div>
                <span className="font-bold text-primary">{u.actions} ações</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
