import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getMatrizVendas, type MatrizVenda } from '@/services/matriz-vendas'
import { useRealtime } from '@/hooks/use-realtime'

const MESES = ['janeiro', 'fevereiro', 'maro', 'abril', 'maio', 'junho', 'julho', 'agosto']
const MESES_LABELS: Record<string, string> = {
  janeiro: 'Jan',
  fevereiro: 'Fev',
  maro: 'Mar',
  abril: 'Abr',
  maio: 'Mai',
  junho: 'Jun',
  julho: 'Jul',
  agosto: 'Ago',
}

export default function MatrizVendas() {
  const [data, setData] = useState<MatrizVenda[]>([])
  const [loading, setLoading] = useState(true)

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

  useRealtime('matriz_vendas', () => {
    loadData()
  })

  const { rows, colTotals } = useMemo(() => {
    const rowMap = new Map<
      string,
      { pais: string; carteira: string; valores: Map<string, number> }
    >()
    const totals = new Map<string, number>()

    data.forEach((r) => {
      const key = `${r.pais}|||${r.carteira}`
      if (!rowMap.has(key)) {
        rowMap.set(key, { pais: r.pais, carteira: r.carteira, valores: new Map() })
      }
      rowMap.get(key)!.valores.set(r.mes, r.valor)
      totals.set(r.mes, (totals.get(r.mes) || 0) + r.valor)
    })

    const sortedRows = Array.from(rowMap.values()).sort(
      (a, b) => a.pais.localeCompare(b.pais) || a.carteira.localeCompare(b.carteira),
    )

    return { rows: sortedRows, colTotals: totals }
  }, [data])

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
          <TrendingUp className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matriz de Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Realizados por país, carteira e mês (janeiro–agosto).
          </p>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Realizados por País e Carteira</CardTitle>
          <CardDescription>{rows.length} combinação(ões) país/carteira</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">País</TableHead>
                    <TableHead className="min-w-[120px]">Carteira</TableHead>
                    {MESES.map((m) => (
                      <TableHead key={m} className="text-right">
                        {MESES_LABELS[m]}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={MESES.length + 3}
                        className="text-center text-muted-foreground h-16"
                      >
                        Nenhum dado encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const rowTotal = Array.from(row.valores.values()).reduce((s, v) => s + v, 0)
                      return (
                        <TableRow key={`${row.pais}-${row.carteira}`}>
                          <TableCell className="font-medium">{row.pais}</TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold uppercase">{row.carteira}</span>
                          </TableCell>
                          {MESES.map((m) => (
                            <TableCell key={m} className="text-right text-sm">
                              {row.valores.has(m) ? formatCurrency(row.valores.get(m)!) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-bold text-primary">
                            {formatCurrency(rowTotal)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                  <TableRow className="border-t-2 font-bold bg-muted/30">
                    <TableCell colSpan={2}>Total Geral</TableCell>
                    {MESES.map((m) => (
                      <TableCell key={m} className="text-right">
                        {colTotals.has(m) ? formatCurrency(colTotals.get(m)!) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-primary">
                      {formatCurrency(Array.from(colTotals.values()).reduce((s, v) => s + v, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
