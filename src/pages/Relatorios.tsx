import { useState, useEffect, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Loader2 } from 'lucide-react'

const STATE_REGIONS = [
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
const INDIRECT_TYPES = [
  'Representantes',
  'Distribuidores',
  'Revendas',
  'Cooperativas',
  'Indústrias',
]

export default function Relatorios() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [period, setPeriod] = useState<string>('monthly')
  const [channel, setChannel] = useState<string>('all')
  const [indirectType, setIndirectType] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')

  useEffect(() => {
    pb.collection('orders')
      .getFullList({
        expand: 'factoryId',
      })
      .then((res) => {
        setOrders(res)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const states = useMemo(() => {
    const s = new Set<string>()
    orders.forEach((o) => {
      if (o.expand?.factoryId?.state) s.add(o.expand.factoryId.state)
    })
    return Array.from(s).sort()
  }, [orders])

  const filteredOrders = useMemo(() => {
    let now = new Date()
    let startDate = new Date()

    if (period === 'weekly') {
      startDate.setDate(now.getDate() - 7)
    } else if (period === 'monthly') {
      startDate.setMonth(now.getMonth() - 1)
    } else if (period === 'quarterly') {
      startDate.setMonth(now.getMonth() - 4)
    } else if (period === 'yearly') {
      startDate.setFullYear(now.getFullYear() - 1)
    }

    return orders.filter((o) => {
      const d = new Date(o.orderDate)
      if (d < startDate) return false

      const f = o.expand?.factoryId
      if (!f) return false

      if (channel !== 'all' && f.salesChannel !== channel) return false
      if (
        channel === 'Indirect' &&
        indirectType !== 'all' &&
        f.indirectChannelType !== indirectType
      )
        return false

      if (stateFilter !== 'all' && f.state !== stateFilter) return false
      if (regionFilter !== 'all' && f.stateRegion !== regionFilter) return false

      return true
    })
  }, [orders, period, channel, indirectType, stateFilter, regionFilter])

  const totalVolume = filteredOrders.reduce((acc, o) => acc + o.totalValue, 0)
  const totalQuantity = filteredOrders.reduce((acc, o) => acc + o.quantity, 0)

  const volumeByLine = useMemo(() => {
    const map = new Map<string, number>()
    filteredOrders.forEach((o) => {
      const line = o.line || 'Outros'
      map.set(line, (map.get(line) || 0) + o.totalValue)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredOrders])

  const volumeByProduct = useMemo(() => {
    const map = new Map<string, number>()
    filteredOrders.forEach((o) => {
      const p = o.product || 'Desconhecido'
      map.set(p, (map.get(p) || 0) + o.totalValue)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filteredOrders])

  const volumeByCustomer = useMemo(() => {
    const map = new Map<string, number>()
    filteredOrders.forEach((o) => {
      const c = o.expand?.factoryId?.name || 'Desconhecido'
      map.set(c, (map.get(c) || 0) + o.totalValue)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [filteredOrders])

  const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ]

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios de Vendas</h1>
        <p className="text-muted-foreground text-sm">
          Analise volumes e performance por diversos recortes.
        </p>
      </div>

      <Card className="border shadow-subtle">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Última Semana</SelectItem>
                <SelectItem value="monthly">Último Mês</SelectItem>
                <SelectItem value="quarterly">Últimos 4 Meses (Quadrimestral)</SelectItem>
                <SelectItem value="yearly">Último Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Canal de Venda</label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os canais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Direct">Venda Direta</SelectItem>
                <SelectItem value="Indirect">Venda Indireta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {channel === 'Indirect' && (
            <div className="space-y-2 animate-fade-in">
              <label className="text-xs font-medium text-muted-foreground">
                Tipo de Canal Indireto
              </label>
              <Select value={indirectType} onValueChange={setIndirectType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {INDIRECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Estado (UF)</label>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {states.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Região</label>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {STATE_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volume de Vendas (R$)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatCurrency(totalVolume)}</div>
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volume em Quantidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalQuantity} <span className="text-sm font-normal text-muted-foreground">un.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos Filtrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredOrders.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>Vendas por Linha de Produto</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {volumeByLine.length > 0 ? (
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={volumeByLine}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {volumeByLine.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle>Top Produtos</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {volumeByProduct.length > 0 ? (
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeByProduct} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `R$ ${v / 1000}k`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Top Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          {volumeByCustomer.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Volume (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volumeByCustomer.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(c.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
              Sem dados para exibir
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
