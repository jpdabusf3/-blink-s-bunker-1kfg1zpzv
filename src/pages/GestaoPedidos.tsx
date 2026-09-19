import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  gestaoPedidosService,
  type PedidoRecord,
  type PedidoInput,
  type PedidoStatus,
  type ClienteOption,
  type ProdutoOption,
} from '@/services/gestao-pedidos'
import { GestaoPedidoModal } from '@/components/GestaoPedidoModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useRealtimeData, useRealtimeDataContext } from '@/hooks/useRealtimeData'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Calendar,
  AlertCircle,
  Package,
  RotateCw,
  ShoppingBag,
  FileCheck2,
  XCircle,
  Clock,
} from 'lucide-react'

type SortField = 'dataPedido' | 'valorTotal'
type SortOrder = 'asc' | 'desc'

export default function GestaoPedidos() {
  const { toast } = useToast()

  // Modal de cadastro/edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPedido, setEditingPedido] = useState<PedidoRecord | null>(null)

  // Diálogo de confirmação de exclusão
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [clienteFilter, setClienteFilter] = useState<string>('all')
  const [dataInicio, setDataInicio] = useState<string>('')
  const [dataFim, setDataFim] = useState<string>('')

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('dataPedido')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Catálogos auxiliares para seleção e resolução de nomes
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [produtos, setProdutos] = useState<ProdutoOption[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)

  // Mapas para lookup rápido caso o expand do PocketBase venha vazio
  const clientesMap = useMemo(() => {
    const map = new Map<string, ClienteOption>()
    clientes.forEach((c) => map.set(c.id, c))
    return map
  }, [clientes])

  const produtosMap = useMemo(() => {
    const map = new Map<string, ProdutoOption>()
    produtos.forEach((p) => map.set(p.id, p))
    return map
  }, [produtos])

  // Carregar listas de Clientes e Produtos
  const loadCatalogs = useCallback(async () => {
    try {
      setCatalogLoading(true)
      const [cls, prds] = await Promise.all([
        gestaoPedidosService.listClientes(),
        gestaoPedidosService.listProdutos(),
      ])
      setClientes(cls)
      setProdutos(prds)
    } catch (err) {
      console.error('Erro ao carregar catálogos:', err)
    } finally {
      setCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalogs()
  }, [loadCatalogs])

  const { notifyDataChanged } = useRealtimeDataContext()

  // Buscar pedidos com suporte a tempo real usando o hook useRealtimeData
  const {
    data: pedidosList,
    isLoading,
    isError,
    refetch: refetchPedidos,
  } = useRealtimeData<PedidoRecord[]>({
    entities: ['pedidos'],
    fetcher: async () => {
      return await gestaoPedidosService.listPedidos()
    },
  })

  // Ações de salvamento (criar ou atualizar)
  const handleSavePedido = async (data: PedidoInput) => {
    try {
      if (editingPedido) {
        await gestaoPedidosService.updatePedido(editingPedido.id, data)
      } else {
        await gestaoPedidosService.createPedido(data)
      }
      toast({
        title: 'Sucesso',
        description: 'Pedido salvo com sucesso.',
      })
      notifyDataChanged('pedidos')
      await refetchPedidos()
    } catch (err) {
      console.error('Erro ao salvar pedido:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o pedido.',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Ação de exclusão
  const handleConfirmDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await gestaoPedidosService.deletePedido(deletingId)
      toast({
        title: 'Sucesso',
        description: 'Pedido excluído.',
      })
      notifyDataChanged('pedidos')
      await refetchPedidos()
    } catch (err) {
      console.error('Erro ao excluir pedido:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o pedido.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  // Alteração inline de status
  const handleInlineStatusChange = async (pedidoId: string, newStatus: PedidoStatus) => {
    try {
      await gestaoPedidosService.updateStatus(pedidoId, newStatus)
      toast({
        title: 'Status atualizado',
        description: `Status alterado para ${newStatus}.`,
      })
      notifyDataChanged('pedidos')
      await refetchPedidos()
    } catch (err) {
      console.error('Erro ao atualizar status inline:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      })
    }
  }

  // Toggle de ordenação
  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Filtragem e ordenação dos pedidos
  const rawList = pedidosList || []

  const filteredPedidos = useMemo(() => {
    let list = [...rawList]

    // Filtro de status
    if (statusFilter !== 'all') {
      list = list.filter((p) => p.status === statusFilter)
    }

    // Filtro de cliente
    if (clienteFilter !== 'all') {
      list = list.filter((p) => p.clienteId === clienteFilter)
    }

    // Período por dataPedido
    if (dataInicio) {
      list = list.filter((p) => {
        if (!p.dataPedido) return false
        const d = p.dataPedido.substring(0, 10)
        return d >= dataInicio
      })
    }
    if (dataFim) {
      list = list.filter((p) => {
        if (!p.dataPedido) return false
        const d = p.dataPedido.substring(0, 10)
        return d <= dataFim
      })
    }

    // Ordenação
    list.sort((a, b) => {
      let comp = 0
      if (sortField === 'dataPedido') {
        const dateA = a.dataPedido ? new Date(a.dataPedido).getTime() : 0
        const dateB = b.dataPedido ? new Date(b.dataPedido).getTime() : 0
        comp = dateA - dateB
      } else if (sortField === 'valorTotal') {
        const valA = Number(a.valorTotal) || 0
        const valB = Number(b.valorTotal) || 0
        comp = valA - valB
      }
      return sortOrder === 'asc' ? comp : -comp
    })

    return list
  }, [rawList, statusFilter, clienteFilter, dataInicio, dataFim, sortField, sortOrder])

  // Totalizadores dos pedidos filtrados
  const totalValor = useMemo(() => {
    return filteredPedidos.reduce((acc, p) => acc + (Number(p.valorTotal) || 0), 0)
  }, [filteredPedidos])

  // Resolução amigável do nome do cliente
  const resolveClienteNome = (pedido: PedidoRecord): string => {
    if (pedido.expand?.clienteId?.name) {
      return pedido.expand.clienteId.name
    }
    if (pedido.clienteId && clientesMap.has(pedido.clienteId)) {
      return clientesMap.get(pedido.clienteId)!.name
    }
    // Fallback amigável
    return 'Cliente não encontrado'
  }

  // Resolução amigável do nome do produto
  const resolveProdutoNome = (pedido: PedidoRecord): string => {
    if (pedido.expand?.produtoId?.nome) {
      const p = pedido.expand.produtoId
      return p.codigo ? `${p.nome} (${p.codigo})` : p.nome
    }
    if (pedido.produtoId && produtosMap.has(pedido.produtoId)) {
      const p = produtosMap.get(pedido.produtoId)!
      return p.codigo ? `${p.nome} (${p.codigo})` : p.nome
    }
    return 'Produto não encontrado'
  }

  // Formatação de data
  const formatDateBR = (dateStr?: string): string => {
    if (!dateStr) return '-'
    try {
      const cleanDate = dateStr.substring(0, 10)
      const [year, month, day] = cleanDate.split('-')
      if (!year || !month || !day) return '-'
      return `${day}/${month}/${year}`
    } catch {
      return '-'
    }
  }

  // Badge de status com cores semânticas
  const renderStatusBadge = (status: PedidoStatus) => {
    switch (status) {
      case 'ABERTO':
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700/50 flex items-center gap-1 font-medium"
          >
            <Clock className="w-3 h-3" /> ABERTO
          </Badge>
        )
      case 'FATURADO':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50 flex items-center gap-1 font-medium"
          >
            <FileCheck2 className="w-3 h-3" /> FATURADO
          </Badge>
        )
      case 'CANCELADO':
        return (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700/50 flex items-center gap-1 font-medium"
          >
            <XCircle className="w-3 h-3" /> CANCELADO
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status || 'ABERTO'}</Badge>
    }
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setClienteFilter('all')
    setDataInicio('')
    setDataFim('')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-primary" />
            Gestão de Pedidos
          </h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe, cadastre e gerencie os pedidos comerciais da Blink Biotech.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingPedido(null)
              setModalOpen(true)
            }}
            className="gap-2 shadow-sm bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Novo Pedido
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total de Pedidos</p>
            <p className="text-2xl font-bold">{filteredPedidos.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(totalValor)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Abertos</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {filteredPedidos.filter((p) => p.status === 'ABERTO').length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Faturados</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {filteredPedidos.filter((p) => p.status === 'FATURADO').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" /> Filtros de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ABERTO">ABERTO</SelectItem>
                <SelectItem value="FATURADO">FATURADO</SelectItem>
                <SelectItem value="CANCELADO">CANCELADO</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteFilter} onValueChange={setClienteFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Início */}
          <div className="space-y-2">
            <Label>Período - Data Inicial</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>

          {/* Data Fim */}
          <div className="space-y-2">
            <Label>Período - Data Final</Label>
            <div className="flex gap-2">
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              <Button
                variant="outline"
                onClick={clearFilters}
                className="shrink-0"
                title="Limpar Filtros"
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela / Cards / Estados de Carregamento, Erro e Vazio */}
      {isError ? (
        // ESTADO DE ERRO
        <Card className="border-destructive/30 bg-destructive/5 shadow-subtle">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Não foi possível carregar os pedidos
              </h3>
              <p className="text-sm text-muted-foreground">
                Houve uma falha ao tentar se conectar ao servidor. Verifique sua conexão e tente
                novamente.
              </p>
            </div>
            <Button
              onClick={() => {
                void refetchPedidos()
                void loadCatalogs()
              }}
              variant="default"
              className="gap-2"
            >
              <RotateCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isLoading || catalogLoading ? (
        // ESTADO DE LOADING (Skeletons imitando a tabela)
        <Card className="shadow-subtle">
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border rounded-md p-4 space-y-3">
              <div className="grid grid-cols-6 gap-4 pb-2 border-b">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-6 gap-4 py-2 border-b last:border-b-0 items-center"
                >
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredPedidos.length === 0 ? (
        // ESTADO VAZIO (EMPTY)
        <Card className="shadow-subtle">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-foreground">Nenhum pedido cadastrado</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Não há pedidos que atendam aos filtros selecionados ou ainda não existem pedidos
                cadastrados.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingPedido(null)
                setModalOpen(true)
              }}
              className="gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Criar pedido
            </Button>
          </CardContent>
        </Card>
      ) : (
        // TABELA (Desktop >= 768px) e CARDS (Mobile < 768px)
        <div>
          {/* Versão Desktop: Tabela */}
          <div className="hidden md:block">
            <Card className="shadow-subtle">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Cliente</TableHead>
                        <TableHead className="font-semibold">Produto</TableHead>
                        <TableHead className="text-right font-semibold">Quantidade</TableHead>
                        <TableHead
                          className="text-right font-semibold cursor-pointer select-none hover:text-primary transition-colors"
                          onClick={() => handleSortToggle('valorTotal')}
                        >
                          <div className="inline-flex items-center gap-1 justify-end">
                            <span>Valor Total</span>
                            {sortField === 'valorTotal' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground opacity-60" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead
                          className="font-semibold cursor-pointer select-none hover:text-primary transition-colors"
                          onClick={() => handleSortToggle('dataPedido')}
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Data Pedido / Entrega</span>
                            {sortField === 'dataPedido' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-primary" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground opacity-60" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="text-right font-semibold pr-4">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPedidos.map((pedido) => (
                        <TableRow key={pedido.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-medium">
                            <span
                              className="block max-w-[200px] truncate"
                              title={resolveClienteNome(pedido)}
                            >
                              {resolveClienteNome(pedido)}
                            </span>
                            {pedido.nfNumero && (
                              <span className="text-[11px] text-muted-foreground">
                                NF: {pedido.nfNumero}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className="block max-w-[220px] truncate text-sm"
                              title={resolveProdutoNome(pedido)}
                            >
                              {resolveProdutoNome(pedido)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {Number(pedido.quantidade) || 0}
                          </TableCell>
                          <TableCell className="text-right font-semibold font-mono text-sm text-primary">
                            {formatCurrency(Number(pedido.valorTotal) || 0)}
                          </TableCell>
                          <TableCell>
                            {/* Dropdown direto na linha para alteração rápida de status */}
                            <div className="flex items-center gap-2">
                              <Select
                                value={pedido.status || 'ABERTO'}
                                onValueChange={(val: PedidoStatus) =>
                                  handleInlineStatusChange(pedido.id, val)
                                }
                              >
                                <SelectTrigger className="h-8 w-[125px] text-xs font-medium border-muted/80">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ABERTO">ABERTO</SelectItem>
                                  <SelectItem value="FATURADO">FATURADO</SelectItem>
                                  <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{formatDateBR(pedido.dataPedido)}</div>
                            {pedido.dataEntregaPrevista ? (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span>Prev:</span> {formatDateBR(pedido.dataEntregaPrevista)}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground/60">-</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Editar pedido"
                                onClick={() => {
                                  setEditingPedido(pedido)
                                  setModalOpen(true)
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                title="Excluir pedido"
                                onClick={() => setDeletingId(pedido.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Versão Mobile (< 768px): Cards Responsivos */}
          <div className="block md:hidden space-y-3">
            {filteredPedidos.map((pedido) => (
              <Card key={pedido.id} className="shadow-subtle p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate text-base">
                      {resolveClienteNome(pedido)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {resolveProdutoNome(pedido)}
                    </p>
                  </div>
                  {renderStatusBadge(pedido.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm pt-1 border-t border-border/50">
                  <div>
                    <span className="text-xs text-muted-foreground block">Quantidade</span>
                    <span className="font-medium font-mono">{pedido.quantidade}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Valor Total</span>
                    <span className="font-bold font-mono text-primary">
                      {formatCurrency(pedido.valorTotal || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Data do Pedido</span>
                    <span>{formatDateBR(pedido.dataPedido)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Data Entrega</span>
                    <span>{formatDateBR(pedido.dataEntregaPrevista)}</span>
                  </div>
                </div>

                {pedido.nfNumero && (
                  <p className="text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded inline-block">
                    NF: {pedido.nfNumero}
                  </p>
                )}

                <div className="pt-2 border-t flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Select
                      value={pedido.status || 'ABERTO'}
                      onValueChange={(val: PedidoStatus) =>
                        handleInlineStatusChange(pedido.id, val)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs font-medium w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ABERTO">ABERTO</SelectItem>
                        <SelectItem value="FATURADO">FATURADO</SelectItem>
                        <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 gap-1 text-xs"
                      onClick={() => {
                        setEditingPedido(pedido)
                        setModalOpen(true)
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-destructive border-destructive/20 hover:bg-destructive/10"
                      onClick={() => setDeletingId(pedido.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <GestaoPedidoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        pedidoToEdit={editingPedido}
        clientes={clientes}
        produtos={produtos}
        onSave={handleSavePedido}
      />

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o pedido permanentemente do sistema. Tem certeza que deseja
              prosseguir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
