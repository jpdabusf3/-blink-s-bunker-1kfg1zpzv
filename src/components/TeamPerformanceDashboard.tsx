import { useState, useEffect, useMemo } from 'react'
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
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import {
  getTeamPerformance,
  type TeamPerformance as TeamPerfData,
} from '@/services/team-performance'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { Loader2, BarChart3, PieChart as PieChartIcon, Activity, Layers } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

const PALETTE = [
  'hsl(var(--primary))',
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

  useRealtimeData('activity_logs', loadData)

  // Total de ações registradas na distribuição
  const totalActionsCount = useMemo(() => {
    if (!data) return 0
    return (
      data.actionTypeDistribution?.reduce((acc, item) => acc + item.value, 0) || data.totalLogs || 0
    )
  }, [data])

  // Normalização e formatação resumida dos tipos de ação
  const formattedDistribution = useMemo(() => {
    if (!data || !data.actionTypeDistribution) return []

    const formatName = (rawName: string): string => {
      if (!rawName) return 'Outros'
      const trimmed = rawName.trim()
      if (trimmed.startsWith('Fábrica atualizada:')) return 'Atualização de Fábrica'
      if (trimmed.startsWith('Fábrica cadastrada:')) return 'Cadastro de Fábrica'
      if (trimmed.startsWith('Cliente ativo,')) return 'Status de Cliente'
      if (trimmed.startsWith('Reunião com Time')) return 'Reunião com Time'
      if (trimmed === 'Logged In') return 'Login'
      if (trimmed === 'Signed Up') return 'Cadastro'
      if (trimmed === 'Created Record' || trimmed === 'Created Factory') return 'Registro Criado'
      if (trimmed === 'Updated Record' || trimmed === 'Updated Factory')
        return 'Registro Atualizado'
      if (trimmed === 'Deleted Record' || trimmed === 'Deleted Factory') return 'Registro Excluído'
      if (trimmed === 'Vendedor cadastrado') return 'Vendedor Cadastrado'
      if (trimmed === 'Usuário cadastrado') return 'Usuário Cadastrado'
      if (trimmed === 'Usuário editado') return 'Usuário Editado'
      if (trimmed === 'Usuário excluído') return 'Usuário Excluído'
      if (trimmed.length > 28) {
        return trimmed.substring(0, 26) + '…'
      }
      return trimmed
    }

    // Agrupa e consolida para evitar fatias minúsculas e poluição visual
    const groupedMap = new Map<string, number>()
    data.actionTypeDistribution.forEach((item) => {
      const friendly = formatName(item.name)
      groupedMap.set(friendly, (groupedMap.get(friendly) || 0) + item.value)
    })

    const sorted = Array.from(groupedMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Top 4 categorias principais + "Outros" se houver mais
    if (sorted.length <= 5) {
      return sorted
    }

    const top4 = sorted.slice(0, 4)
    const othersValue = sorted.slice(4).reduce((acc, cur) => acc + cur.value, 0)
    if (othersValue > 0) {
      top4.push({ name: 'Outras ações', value: othersValue })
    }
    return top4
  }, [data])

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
        <Card className="shadow-subtle flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="w-5 h-5 text-primary" /> Ações por Usuário
            </CardTitle>
            <CardDescription>Total de atividades por membro da equipe</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] flex-1">
            <ChartContainer
              config={{ actions: { label: 'Ações', color: 'hsl(var(--primary))' } }}
              className="h-full w-full"
            >
              <BarChart
                data={topUsers}
                layout="vertical"
                margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
              >
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
                  width={110}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="actions"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-subtle flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <PieChartIcon className="w-5 h-5 text-primary" /> Distribuição de Ações
              </CardTitle>
              <Badge variant="secondary" className="font-normal text-xs gap-1.5 py-0.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>{totalActionsCount} no período</span>
              </Badge>
            </div>
            <CardDescription>Tipos de atividades registradas de forma consolidada</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between pt-0 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center min-h-[220px]">
              {/* Gráfico Donut compacto e limpo */}
              <div className="sm:col-span-6 h-[200px] w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formattedDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    >
                      {formattedDistribution.map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={PALETTE[idx % PALETTE.length]}
                          className="transition-all duration-200 hover:opacity-85"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number, name: string) => [
                        `${val} (${totalActionsCount > 0 ? ((val / totalActionsCount) * 100).toFixed(1) : 0}%)`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Centro do Donut com total resumido */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    {totalActionsCount}
                  </span>
                  <span className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground">
                    Ações
                  </span>
                </div>
              </div>

              {/* Lista Resumida e Legenda Visual Clara */}
              <div className="sm:col-span-6 flex flex-col gap-2">
                {formattedDistribution.map((item, idx) => {
                  const pct =
                    totalActionsCount > 0
                      ? ((item.value / totalActionsCount) * 100).toFixed(0)
                      : '0'
                  const color = PALETTE[idx % PALETTE.length]

                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between p-1.5 px-2.5 rounded-md bg-muted/40 hover:bg-muted/70 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium truncate text-foreground/90" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="text-muted-foreground text-[11px] font-normal">
                          {item.value}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 border-border/60 bg-background/50 font-semibold"
                        >
                          {pct}%
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rodapé resumo visual */}
            <div className="mt-2 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                {formattedDistribution.length} categorias agrupadas
              </span>
              <span className="font-medium text-foreground">
                Principal: {formattedDistribution[0]?.name || 'N/A'} (
                {totalActionsCount > 0 && formattedDistribution[0]
                  ? `${((formattedDistribution[0].value / totalActionsCount) * 100).toFixed(0)}%`
                  : '0%'}
                )
              </span>
            </div>
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
