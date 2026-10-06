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
import { useRealtimeData } from '@/hooks/useRealtimeData'
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

  useRealtimeData('orders', loadData)

  const filteredOrders = useMemo(() => {
    let res = [...orders]
    if (regionFilter !== 'Todas as Regiões') {
      const regionFactoryIds = new Set(
        factories
          .filter((f) => f.region === regionFilter || f.stateRegion === regionFilter)
          .map((f) => f.id),
      )
      res = res.filter(
        (o) => regionFactoryIds.has(o.factoryId) || (o as any).region === regionFilter,
      )
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
    <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 text-white">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-[#E5B64E] text-base font-bold">Diário de Vendas</CardTitle>
        <CardDescription className="text-[#A1A1AA] text-xs">
          Últimos pedidos {regionFilter !== 'Todas as Regiões' ? `- ${regionFilter}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="mb-3 p-3 bg-[#232329] border border-[#3A3A42] rounded-[12px] flex justify-between items-center">
          <span className="text-xs uppercase tracking-wider text-[#A1A1AA] font-semibold">
            Total de Hoje:
          </span>
          <span className="font-bold text-[#E5B64E] text-base tabular-nums">
            {formatCurrency(todayTotal)}
          </span>
        </div>
        <div className="max-h-[200px] overflow-y-auto blink-table">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#3A3A42] bg-[#32343A]">
                <TableHead className="text-white text-xs uppercase font-semibold">Data</TableHead>
                <TableHead className="text-white text-xs uppercase font-semibold">
                  Fábrica
                </TableHead>
                <TableHead className="text-white text-xs uppercase font-semibold text-right">
                  Valor
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-[#A1A1AA] text-sm py-4">
                    Nenhum pedido recente.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o, idx) => {
                  const factory = factories.find((f) => f.id === o.factoryId)
                  return (
                    <TableRow
                      key={o.id}
                      className={`${idx % 2 === 0 ? 'bg-[#2A2A31]' : 'bg-[#232329]'} border-b border-[#3A3A42] hover:bg-[#363640] hover:border-l-2 hover:border-l-[#E5B64E] transition-all`}
                    >
                      <TableCell className="text-xs whitespace-nowrap text-[#A1A1AA]">
                        {new Date(o.orderDate).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-white">
                        {factory?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold text-[#E5B64E] tabular-nums">
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
