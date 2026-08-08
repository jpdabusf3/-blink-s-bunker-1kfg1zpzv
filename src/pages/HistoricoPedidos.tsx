import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, History } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getHistoricoPedidos, type HistoricoPedido } from '@/services/historico-pedidos'

export default function HistoricoPedidos() {
  const [data, setData] = useState<HistoricoPedido[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const records = await getHistoricoPedidos()
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

  const totalGeral = data.reduce((sum, r) => sum + (r.valor || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
          <History className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Pedidos</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe o histórico de pedidos por marca e mês.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total de Registros</p>
            <p className="text-2xl font-bold">{data.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalGeral)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Pedidos Históricos</CardTitle>
          <CardDescription>{data.length} registro(s)</CardDescription>
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
                    <TableHead>Marca</TableHead>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Total Geral</TableHead>
                    <TableHead>Atualizado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground h-16">
                        Nenhum registro encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.marca}</TableCell>
                        <TableCell className="capitalize">{r.mes}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.valor)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(r.total_geral)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.atualizado_em
                            ? new Date(r.atualizado_em).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
