import { useState, useMemo, useEffect } from 'react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppContext } from '@/store/AppContext'
import { formatCurrency } from '@/lib/utils'
import { exportOrdersToExcel, exportOrdersToPDF } from '@/lib/exportUtils'
import { OrderForm } from '@/components/OrderForm'
import { UserFilter } from '@/components/UserFilter'
import { Plus, Edit2, Trash2, Filter, Download } from 'lucide-react'
import { Order } from '@/types'
import { useToast } from '@/hooks/use-toast'

export default function Pedidos() {
  const { orders, factories, deleteOrder } = useAppContext()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const factoryIdParam = searchParams.get('factoryId') || 'all'
  const isNewParam = searchParams.get('new') === 'true'

  const [isNewDialogOpen, setIsNewDialogOpen] = useState(isNewParam)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [productLine, setProductLine] = useState('all')
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')

  useEffect(() => {
    if (isNewParam) {
      setIsNewDialogOpen(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [isNewParam, searchParams, setSearchParams])

  const filteredOrders = useMemo(() => {
    let res = [...orders]
    if (factoryIdParam !== 'all') {
      res = res.filter((o) => o.factoryId === factoryIdParam)
    }
    if (salesOwnerFilter !== 'all') {
      const allowedFactoryIds = new Set(
        factories.filter((f) => f.salesOwner === salesOwnerFilter).map((f) => f.id),
      )
      res = res.filter((o) => allowedFactoryIds.has(o.factoryId))
    }
    if (productLine !== 'all') {
      res = res.filter((o) => o.line === productLine)
    }
    if (startDate) {
      res = res.filter((o) => new Date(o.orderDate) >= new Date(startDate))
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      res = res.filter((o) => new Date(o.orderDate) <= end)
    }
    return res.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
  }, [orders, factoryIdParam, productLine, startDate, endDate, salesOwnerFilter, factories])

  const handleDelete = () => {
    if (deletingId) {
      deleteOrder(deletingId)
      setDeletingId(null)
      toast({
        title: 'Pedido Excluído',
        description: 'O pedido foi removido permanentemente do histórico.',
      })
    }
  }

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setProductLine('all')
    setSalesOwnerFilter('all')
    setSearchParams({})
  }

  const handleExportExcel = () => {
    if (filteredOrders.length === 0) return

    toast({
      title: 'Exportando Excel',
      description: 'O download do seu arquivo CSV foi iniciado.',
    })

    exportOrdersToExcel(filteredOrders, factories)
  }

  const handleExportPDF = () => {
    if (filteredOrders.length === 0) return

    toast({
      title: 'Gerando PDF',
      description: 'Seu documento está sendo preparado.',
    })

    const success = exportOrdersToPDF(filteredOrders, factories, {
      factoryIdParam,
      productLine,
      startDate,
      endDate,
    })
    if (!success) {
      toast({
        title: 'Aviso',
        description: 'Desbloqueie os pop-ups para gerar o PDF.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico de Pedidos</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe o histórico de compras e registre novos pedidos.
          </p>
        </div>
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" /> Registrar Pedido
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Registrar Novo Pedido</DialogTitle>
            </DialogHeader>
            <OrderForm
              onSubmit={() => setIsNewDialogOpen(false)}
              initialFactoryId={factoryIdParam !== 'all' ? factoryIdParam : undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-subtle mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" /> Filtros Avançados
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 items-end">
          <div className="space-y-2 lg:col-span-1">
            <Label>Data Inicial</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Data Final</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Vendedor</Label>
            <UserFilter
              value={salesOwnerFilter}
              onChange={setSalesOwnerFilter}
              className="bg-background"
            />
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Fábrica</Label>
            <Select
              value={factoryIdParam}
              onValueChange={(val) => setSearchParams(val === 'all' ? {} : { factoryId: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {factories.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-1">
            <Label>Linha</Label>
            <Select value={productLine} onValueChange={setProductLine}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
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
          <div className="flex flex-col sm:flex-row gap-2 lg:col-span-1 w-full">
            <Button
              variant="outline"
              onClick={clearFilters}
              className="w-full text-muted-foreground"
            >
              Limpar Filtros
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={filteredOrders.length === 0}
                  className="w-full gap-2 text-primary border-primary/20 hover:bg-primary/5"
                >
                  <Download className="w-4 h-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF}>Documento PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  Planilha Excel (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Pedidos Realizados</CardTitle>
          <CardDescription>Mostrando {filteredOrders.length} pedido(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Fábrica</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Linha</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">V. Unitário</TableHead>
                  <TableHead className="text-right">V. Total</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground h-32">
                      Nenhum pedido encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
                {filteredOrders.map((o) => {
                  const factory = factories.find((f) => f.id === o.factoryId)
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(o.orderDate).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {factory?.name || 'Desconhecida'}
                        {factory?.priority === 'High' && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-green-500 ml-2"
                            title="Alta Prioridade"
                          />
                        )}
                      </TableCell>
                      <TableCell>{o.product}</TableCell>
                      <TableCell>{o.line || '-'}</TableCell>
                      <TableCell className="text-right">{o.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(o.unitValue)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(o.totalValue)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingOrder(o)}
                            title="Editar pedido"
                          >
                            <Edit2 className="w-4 h-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(o.id)}
                            title="Excluir pedido"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Editar Pedido</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <OrderForm onSubmit={() => setEditingOrder(null)} initialOrder={editingOrder} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este pedido permanentemente? Esta ação não poderá ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
