import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppContext } from '@/store/AppContext'
import { formatCurrency } from '@/lib/utils'

export default function Pedidos() {
  const { orders, factories } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const factoryIdParam = searchParams.get('factoryId') || 'all'

  const filteredOrders = useMemo(() => {
    let res = [...orders]
    if (factoryIdParam !== 'all') {
      res = res.filter((o) => o.factoryId === factoryIdParam)
    }
    return res.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
  }, [orders, factoryIdParam])

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico de Pedidos</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe o histórico de compras e valores por produto.
        </p>
      </div>

      <Card className="shadow-subtle">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Pedidos Realizados</CardTitle>
            <CardDescription>Visualize e filtre por fábrica</CardDescription>
          </div>
          <Select
            value={factoryIdParam}
            onValueChange={(val) => setSearchParams(val === 'all' ? {} : { factoryId: val })}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Filtrar por fábrica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Fábricas</SelectItem>
              {factories.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data do Pedido</TableHead>
                  <TableHead>Fábrica</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Valor Unitário</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
                      Nenhum pedido encontrado para o filtro selecionado.
                    </TableCell>
                  </TableRow>
                )}
                {filteredOrders.map((o) => {
                  const factory = factories.find((f) => f.id === o.factoryId)
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        {new Date(o.orderDate).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{factory?.name || 'Desconhecida'}</TableCell>
                      <TableCell>{o.product}</TableCell>
                      <TableCell className="text-right">{o.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(o.unitValue)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(o.totalValue)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
