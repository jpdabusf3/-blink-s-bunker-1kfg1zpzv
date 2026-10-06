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
import { useAppContext } from '@/store/AppContext'
import { getOrders } from '@/services/orders'
import { getTargets } from '@/services/targets'
import { Order, Target } from '@/types'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { normalizeArray } from '@/lib/utils'

const COLORS = [
  '#E5B64E', // Gold (primary series)
  '#E85635', // Orange (secondary accent)
  '#C99A36',
  '#F3C96B',
  '#71717A',
]

export function DashboardCharts({ regionFilter = 'Todas as Regiões' }: { regionFilter?: string }) {
  const { factories } = useAppContext()
  const [orders, setOrders] = useState<Order[]>([])
  const [targets, setTargets] = useState<Target[]>([])

  const loadData = async () => {
    try {
      const [o, t] = await Promise.all([getOrders(), getTargets()])
      setOrders(o)
      setTargets(t)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtimeData('orders', loadData)
  useRealtimeData('targets', loadData)

  const filteredFactories =
    regionFilter === 'Todas as Regiões'
      ? factories
      : factories.filter((f) => f.region === regionFilter)

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
      value: filteredFactories
        .filter((f) => f.funnelStage === stage)
        .reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)

  const regionData = [
    'Norte',
    'Nordeste',
    'Centro-Oeste',
    'Sudeste',
    'Sul',
    'Oeste',
    'Leste',
    'Médio-Norte',
    'Noroeste',
    'Sudoeste',
    'Centro',
  ]
    .map((regionName) => ({
      name: regionName,
      value: filteredFactories
        .filter((f) => {
          const rArr = normalizeArray(f.region)
          return rArr.includes(regionName) || f.stateRegion === regionName
        })
        .reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)

  const topVolume = [...filteredFactories]
    .sort((a, b) => b.capacity - a.capacity)
    .slice(0, 5)
    .map((f) => ({ name: f.name.substring(0, 15), value: f.capacity }))

  const productData = ['Adsorventes', 'Prebióticos', 'Minerais Orgânicos', 'Blends', 'Ingredientes']
    .map((line) => ({
      name: line,
      value: filteredFactories
        .filter((f) => {
          const lines = normalizeArray(f.productLineAffinity)
          return lines.includes(line)
        })
        .reduce((s, f) => s + f.potentialValue, 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  // Closing Projection Logic
  const projectionData = targets
    .map((target) => {
      let totalSales = 0
      const startDate = new Date(target.startDate)
      const endDate = new Date(target.endDate)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      for (const order of orders) {
        const orderDate = new Date(order.orderDate || (order as any).created)
        if (orderDate >= startDate && orderDate <= endDate) {
          let match = false
          const catType = target.categoryType
          const catVal = target.categoryValue

          if (catType === 'General') {
            match = true
          } else if (catType === 'ProductLine') {
            if (order.line === catVal || order.product === catVal) match = true
          } else {
            const factory = factories.find((f) => f.id === order.factoryId)
            if (factory) {
              if (catType === 'Region' && factory.region === catVal) match = true
              if (catType === 'Channel' && factory.salesChannel === catVal) match = true
            }
          }

          // Apply regionFilter if needed
          if (match && regionFilter !== 'Todas as Regiões') {
            const factory = factories.find((f) => f.id === order.factoryId)
            if (!factory || factory.region !== regionFilter) {
              match = false
            }
          }

          if (match) {
            totalSales += order.totalValue
          }
        }
      }

      const now = new Date()
      const totalDuration = endDate.getTime() - startDate.getTime()
      let elapsed = now.getTime() - startDate.getTime()
      if (elapsed < 0) elapsed = 0
      if (elapsed > totalDuration) elapsed = totalDuration

      const elapsedDays = elapsed / (1000 * 60 * 60 * 24)
      const totalDays = totalDuration / (1000 * 60 * 60 * 24)

      const projected = elapsedDays > 0 ? (totalSales / elapsedDays) * totalDays : 0
      const status = projected >= target.targetValue ? 'On Track' : 'At Risk'

      return {
        name: target.name.substring(0, 15),
        Meta: target.targetValue,
        Atual: totalSales,
        Projetado: Math.round(projected),
        Status: status,
      }
    })
    .filter((d) => d.Meta > 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-[#2A2A31] border border-[#3A3A42] text-white p-3 rounded-[12px] shadow-lg text-sm z-50">
          <p className="font-semibold mb-2 text-[#E5B64E]">{data.name}</p>
          <div className="space-y-1">
            <p>
              <span className="font-medium text-[#A1A1AA]">Meta:</span> R${' '}
              {data.Meta.toLocaleString('pt-BR')}
            </p>
            <p>
              <span className="font-medium text-[#E5B64E]">Atual:</span> R${' '}
              {data.Atual.toLocaleString('pt-BR')}
            </p>
            <p>
              <span className="font-medium text-[#E85635]">Projetado:</span> R${' '}
              {data.Projetado.toLocaleString('pt-BR')}
            </p>
            <div className="mt-2 pt-2 border-t border-[#3A3A42]">
              <span
                className={`font-semibold ${data.Status === 'On Track' ? 'text-green-400' : 'text-[#E85635]'}`}
              >
                {data.Status === 'On Track' ? 'No Caminho (On Track)' : 'Em Risco (At Risk)'}
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
      {projectionData.length > 0 && (
        <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 text-white print:hidden lg:col-span-2">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-[#E5B64E] text-base font-bold">
              Projeção de Fechamento
            </CardTitle>
            <CardDescription className="text-[#A1A1AA] text-xs">
              Acompanhamento de Metas vs. Realizado vs. Projetado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 h-[300px]">
            <ChartContainer
              config={{
                Meta: { label: 'Meta (R$)', color: '#A1A1AA' },
                Atual: { label: 'Atual (R$)', color: '#E5B64E' },
                Projetado: { label: 'Projetado (R$)', color: '#E85635' },
              }}
              className="h-full w-full"
            >
              <BarChart data={projectionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3A3A42" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#A1A1AA' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#A1A1AA' }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#A1A1AA' }} />
                <Bar dataKey="Meta" fill="#71717A" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Atual" fill="#E5B64E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Projetado" fill="#E85635" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 text-white print:hidden">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-[#E5B64E] text-base font-bold">Funil de Vendas</CardTitle>
          <CardDescription className="text-[#A1A1AA] text-xs">Valor por estágio</CardDescription>
        </CardHeader>
        <CardContent className="p-0 h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Valor (R$)', color: '#E5B64E' } }}
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
                tick={{ fontSize: 12, fill: '#A1A1AA' }}
              />
              <Tooltip
                content={
                  <ChartTooltipContent className="bg-[#2A2A31] border-[#3A3A42] text-white" />
                }
              />
              <Bar dataKey="value" fill="#E5B64E" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 text-white print:hidden">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-[#E5B64E] text-base font-bold">
            Distribuição Regional
          </CardTitle>
          <CardDescription className="text-[#A1A1AA] text-xs">Potencial financeiro</CardDescription>
        </CardHeader>
        <CardContent className="p-0 h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Valor', color: '#E5B64E' } }}
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
              <Tooltip
                content={
                  <ChartTooltipContent className="bg-[#2A2A31] border-[#3A3A42] text-white" />
                }
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 text-white print:break-inside-avoid print:shadow-none print:border">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-[#E5B64E] text-base font-bold">
            Ranking Volume de Compras (t/mês)
          </CardTitle>
          <CardDescription className="text-[#A1A1AA] text-xs">
            Maiores capacidades do pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Capacidade', color: '#E5B64E' } }}
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
                tick={{ fontSize: 11, fill: '#A1A1AA' }}
              />
              <Tooltip
                content={
                  <ChartTooltipContent className="bg-[#2A2A31] border-[#3A3A42] text-white" />
                }
              />
              <Bar dataKey="value" fill="#E5B64E" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 text-white print:break-inside-avoid print:shadow-none print:border">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-[#E5B64E] text-base font-bold">
            Ranking Produtos Mais Vendidos
          </CardTitle>
          <CardDescription className="text-[#A1A1AA] text-xs">
            Receita por tendência de linha
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 h-[280px]">
          <ChartContainer
            config={{ value: { label: 'Receita (R$)', color: '#E85635' } }}
            className="h-full w-full"
          >
            <BarChart data={productData} margin={{ left: 10, right: 10, top: 10, bottom: 20 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#A1A1AA' }}
              />
              <YAxis hide />
              <Tooltip
                content={
                  <ChartTooltipContent className="bg-[#2A2A31] border-[#3A3A42] text-white" />
                }
              />
              <Bar dataKey="value" fill="#E85635" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
