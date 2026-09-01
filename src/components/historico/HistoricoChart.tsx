import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type HistoricoChartPoint } from '@/services/historicoService'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils'
import { BarChart3 } from 'lucide-react'

interface HistoricoChartProps {
  data: HistoricoChartPoint[]
  loading: boolean
}

export function HistoricoChart({ data, loading }: HistoricoChartProps) {
  if (loading) {
    return (
      <Card className="border border-border bg-card shadow-sm mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Evolução Mensal: Realizado vs Projetado
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72 flex items-center justify-center">
          <div className="h-48 w-full bg-muted/40 animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return null
  }

  return (
    <Card className="border border-border bg-card shadow-sm mb-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Evolução Mensal: Realizado vs Projetado
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {data.length} {data.length === 1 ? 'mês analisado' : 'meses analisados'}
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="mesAno"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatCompactCurrency(val)}
              />
              <Tooltip
                formatter={(value: any, name: any) => [
                  formatCurrency(Number(value) || 0),
                  name === 'realizado' ? 'Realizado' : name === 'projetado' ? 'Projetado' : name,
                ]}
                labelFormatter={(label) => `Mês/Ano: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                formatter={(value) => (value === 'realizado' ? 'Realizado' : 'Projetado')}
              />
              {/* Série Realizado (cor sólida) */}
              <Bar
                dataKey="realizado"
                name="realizado"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
              {/* Série Projetado (cor mais clara / hachurada) */}
              <Bar
                dataKey="projetado"
                name="projetado"
                fill="#60a5fa"
                fillOpacity={0.7}
                stroke="#3b82f6"
                strokeWidth={1}
                radius={[4, 4, 0, 0]}
                maxBarSize={45}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
