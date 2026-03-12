import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
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

export function FactoryListCard() {
  const { factories, orders } = useAppContext()
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [lineFilter, setLineFilter] = useState<string>('all')

  const filtered = factories.filter((f) => {
    if (sectorFilter !== 'all' && f.sector !== sectorFilter) return false
    if (lineFilter !== 'all' && f.productLineAffinity !== lineFilter) return false
    return true
  })

  return (
    <Card className="shadow-subtle lg:col-span-3 print:hidden">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <CardTitle>Lista de Fábricas</CardTitle>
        <div className="flex gap-2">
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Setores</SelectItem>
              {[
                'Aves',
                'Suínos',
                'PET',
                'Aqua',
                'Bovinos de Corte',
                'Bovinos de Leite',
                'Bovinos em Geral',
                'Equinos',
                'Monogástricos',
                'Ruminantes',
                'Multiespécie',
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={lineFilter} onValueChange={setLineFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue placeholder="Linha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Linhas</SelectItem>
              {['Adsorventes', 'Prebióticos', 'Minerais Orgânicos', 'Blends', 'Ingredientes'].map(
                (l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fábrica</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Linha</TableHead>
                <TableHead className="text-right">Potencial</TableHead>
                <TableHead className="text-right">Data da última compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => {
                const factoryOrders = orders
                  .filter((o) => o.factoryId === f.id)
                  .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
                const lastOrder = factoryOrders[0]

                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.sector}</TableCell>
                    <TableCell>{f.productLineAffinity}</TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(f.potentialValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {lastOrder ? (
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/pedidos?factoryId=${f.id}`}
                            className="text-primary hover:text-primary/80 hover:underline font-medium transition-colors whitespace-nowrap"
                          >
                            {new Date(lastOrder.orderDate).toLocaleDateString('pt-BR')}
                          </Link>
                          <Link
                            to={`/pedidos?factoryId=${f.id}&new=true`}
                            className="text-[10px] bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded transition-colors whitespace-nowrap"
                          >
                            + Pedido
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-muted-foreground text-sm whitespace-nowrap">
                            Sem compras
                          </span>
                          <Link
                            to={`/pedidos?factoryId=${f.id}&new=true`}
                            className="text-[10px] bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded transition-colors whitespace-nowrap"
                          >
                            + Pedido
                          </Link>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
