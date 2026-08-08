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
import { Loader2, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getPedidosCarteira, type PedidoCarteira } from '@/services/pedidos-carteira'
import { useRealtime } from '@/hooks/use-realtime'

const MESES = ['agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export default function PedidosCarteira() {
  const [data, setData] = useState<PedidoCarteira[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const records = await getPedidosCarteira()
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

  useRealtime('pedidos_carteira', () => {
    loadData()
  })

  const { marcas, totalGeralCarteira } = useMemo(() => {
    const marcaMap = new Map<string, Map<string, number>>()
    const totalMap = new Map<string, number>()
    data.forEach((r) => {
      if (!marcaMap.has(r.marca)) marcaMap.set(r.marca, new Map())
      marcaMap.get(r.marca)!.set(r.mes, r.valor)
      if (!totalMap.has(r.marca)) totalMap.set(r.marca, r.total_geral)
    })
    const total = Array.from(totalMap.values()).reduce((s, v) => s + v, 0)
    return { marcas: Array.from(marcaMap.entries()), totalGeralCarteira: total }
  }, [data])

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
          <Wallet className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos em Carteira</h1>
          <p className="text-muted-foreground text-sm">Pedidos em carteira por marca e mês.</p>
        </div>
      </div>

      <Card className="shadow-subtle bg-primary/5">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Geral da Carteira PET</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(totalGeralCarteira)}</p>
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Carteira por Marca</CardTitle>
          <CardDescription>{marcas.length} marca(s)</CardDescription>
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
                    <TableHead className="min-w-[160px]">Marca</TableHead>
                    {MESES.map((m) => (
                      <TableHead key={m} className="text-right capitalize">
                        {m}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total Geral</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marcas.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={MESES.length + 2}
                        className="text-center text-muted-foreground h-16"
                      >
                        Nenhum pedido encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    marcas.map(([marca, mesMap]) => (
                      <TableRow key={marca}>
                        <TableCell className="font-medium">{marca}</TableCell>
                        {MESES.map((m) => (
                          <TableCell key={m} className="text-right">
                            {mesMap.has(m) ? formatCurrency(mesMap.get(m)!) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(data.find((d) => d.marca === marca)?.total_geral || 0)}
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
