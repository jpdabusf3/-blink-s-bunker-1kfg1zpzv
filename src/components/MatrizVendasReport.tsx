import { useState, useEffect, useMemo } from 'react'
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useRealtime } from '@/hooks/use-realtime'
import { getMatrizVendas, type MatrizVenda } from '@/services/matriz-vendas'

const PAISES = ['Brasil', 'Paraguai', 'Chile']
const CARTEIRAS = ['AVES', 'PETS', 'RUMINANTES', 'SUINOS', 'AQUA']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto']

export function MatrizVendasReport() {
  const [data, setData] = useState<MatrizVenda[]>([])
  const [loading, setLoading] = useState(true)
  const [paisFilter, setPaisFilter] = useState('all')
  const [carteiraFilter, setCarteiraFilter] = useState('all')
  const [mesFilter, setMesFilter] = useState('all')

  const loadData = async () => {
    try {
      const records = await getMatrizVendas()
      setData(records)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('matriz_vendas', () => loadData())

  const filtered = useMemo(
    () =>
      data.filter((d) => {
        if (paisFilter !== 'all' && d.pais !== paisFilter) return false
        if (carteiraFilter !== 'all' && d.carteira !== carteiraFilter) return false
        if (mesFilter !== 'all' && d.mes !== mesFilter) return false
        return true
      }),
    [data, paisFilter, carteiraFilter, mesFilter],
  )

  const totalValor = filtered.reduce((sum, d) => sum + (d.valor || 0), 0)

  const chartData = useMemo(() => {
    const map = new Map<string, number>()
    filtered.forEach((d) => {
      const key = d.carteira || 'N/A'
      map.set(key, (map.get(key) || 0) + (d.valor || 0))
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [filtered])

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Matriz de Vendas — Realizado 2026</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">País</label>
              <Select value={paisFilter} onValueChange={setPaisFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {PAISES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Segmento</label>
              <Select value={carteiraFilter} onValueChange={setCarteiraFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {CARTEIRAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Mês</label>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {MESES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {filtered.length} registro(s) | Total:{' '}
              <span className="font-bold text-primary">{formatCurrency(totalValor)}</span>
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="h-[280px]">
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `R$ ${v / 1000}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>País</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-16">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.pais}</TableCell>
                      <TableCell>{d.carteira}</TableCell>
                      <TableCell className="capitalize">{d.mes}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(d.valor)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
