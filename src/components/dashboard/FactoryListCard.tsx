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

export function FactoryListCard({ regionFilter = 'Todas as Regiões' }: { regionFilter?: string }) {
  const { factories, orders } = useAppContext()
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [lineFilter, setLineFilter] = useState<string>('all')

  const filtered = factories.filter((f) => {
    if (regionFilter !== 'Todas as Regiões' && f.region !== regionFilter) return false
    if (sectorFilter !== 'all' && f.sector !== sectorFilter) return false
    if (lineFilter !== 'all' && f.productLineAffinity !== lineFilter) return false
    return true
  })

  return (
    <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 text-white lg:col-span-3 print:hidden">
      <CardHeader className="p-0 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <CardTitle className="text-[#E5B64E] text-base font-bold">Lista de Fábricas</CardTitle>
        <div className="flex gap-2">
          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs bg-[#232329] border-[#3A3A42] text-white rounded-[12px] focus:ring-[#E5B64E]">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent className="bg-[#2A2A31] border-[#3A3A42] text-white">
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
            <SelectTrigger className="w-[180px] h-9 text-xs bg-[#232329] border-[#3A3A42] text-white rounded-[12px] focus:ring-[#E5B64E]">
              <SelectValue placeholder="Linha" />
            </SelectTrigger>
            <SelectContent className="bg-[#2A2A31] border-[#3A3A42] text-white">
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
      <CardContent className="p-0">
        <div className="overflow-x-auto blink-table">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#3A3A42] bg-[#32343A]">
                <TableHead className="text-white text-xs uppercase font-semibold">
                  Fábrica
                </TableHead>
                <TableHead className="text-white text-xs uppercase font-semibold">Setor</TableHead>
                <TableHead className="text-white text-xs uppercase font-semibold">Linha</TableHead>
                <TableHead className="text-right text-white text-xs uppercase font-semibold">
                  Potencial
                </TableHead>
                <TableHead className="text-right text-white text-xs uppercase font-semibold">
                  Data da última compra
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f, idx) => {
                const factoryOrders = orders
                  .filter((o) => o.factoryId === f.id)
                  .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
                const lastOrder = factoryOrders[0]

                return (
                  <TableRow
                    key={f.id}
                    className={`${idx % 2 === 0 ? 'bg-[#2A2A31]' : 'bg-[#232329]'} border-b border-[#3A3A42] hover:bg-[#363640] hover:border-l-2 hover:border-l-[#E5B64E] transition-all`}
                  >
                    <TableCell className="font-medium text-white">{f.name}</TableCell>
                    <TableCell className="text-[#A1A1AA]">{f.sector}</TableCell>
                    <TableCell className="text-[#A1A1AA]">{f.productLineAffinity}</TableCell>
                    <TableCell className="text-right font-medium text-[#E5B64E] tabular-nums">
                      {formatCurrency(f.potentialValue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {lastOrder ? (
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/pedidos?factoryId=${f.id}`}
                            className="text-[#E5B64E] hover:underline font-medium transition-colors whitespace-nowrap text-xs"
                          >
                            {new Date(lastOrder.orderDate).toLocaleDateString('pt-BR')}
                          </Link>
                          <Link
                            to={`/pedidos?factoryId=${f.id}&new=true`}
                            className="text-[10px] bg-[#3A3A42] hover:bg-[#44444C] text-white px-2 py-1 rounded-[6px] transition-colors whitespace-nowrap"
                          >
                            + Pedido
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[#71717A] text-xs whitespace-nowrap">
                            Sem compras
                          </span>
                          <Link
                            to={`/pedidos?factoryId=${f.id}&new=true`}
                            className="text-[10px] bg-[#3A3A42] hover:bg-[#44444C] text-white px-2 py-1 rounded-[6px] transition-colors whitespace-nowrap"
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
