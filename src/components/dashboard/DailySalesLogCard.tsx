import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppContext } from '@/store/AppContext'
import { getOrders } from '@/services/orders'
import { Order } from '@/types'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/utils'

export function DailySalesLogCard({
  regionFilter = 'Todas as Regiões',
}: {
  regionFilter?: string
}) {
  const { factories } = useAppContext()
  const [orders, setOrders] = useState<Order[]>([])

  const loadData = async () => {
    try {
      setOrders(await getOrders())
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime('orders', loadData)

  const filteredOrders = useMemo(() => {
    let res = [...orders]
    if (regionFilter !== 'Todas as Regiões') {
      const regionFactoryIds = new Set(
        factories
          .filter((f) => f.region === regionFilter || f.stateRegion === regionFilter)
          .map((f) => f.id),
      )
      res = res.filter((o) => regionFactoryIds.has(o.factoryId) || (o as any).region === regionFilter)
    }
    return res
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, 10)
  }, [orders, factories, regionFilter])

  const todayTotal = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orders
      .filter((o) => {
        const d = new Date(o.orderDate)
        return d >= today
      })
      .filter((o) => {
        if (regionFilter === 'Todas as Regiões') return true
        const factory = factories.find((f) => f.id === o.factoryId)
        return (
          factory?.region === regionFilter ||
          factory?.stateRegion === regionFilter ||
          (o as any).region === regionFilter
        )
      })
      .reduce((s, o) => s + o.totalValue, 0)
  }, [orders, factories, regionFilter])

  return (
    <Card className="shadow-subtle">
      <CardHeader>
        <CardTitle>Diário de Vendas</CardTitle>
        <CardDescription>
          Últimos pedidos {regionFilter !== 'Todas as Regiões' ? `- ${regionFilter}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 p-3 bg-primary/5 rounded-lg flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total de Hoje:</span>
          <span className="font-bold text-primary">{formatCurrency(todayTotal)}</span>
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Fábrica</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">
                    Nenhum pedido recente.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o) => {
                  const factory = factories.find((f) => f.id === o.factoryId)
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(o.orderDate).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {factory?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold text-primary">
                        {formatCurrency(o.totalValue)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
