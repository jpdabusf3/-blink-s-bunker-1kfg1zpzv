import { useState, useEffect, useMemo, useCallback } from 'react'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Loader2,
  Sparkles,
  ArrowRight,
  Search,
  Filter,
  Layers,
  FileText,
  Building2,
  Truck,
  Receipt,
  Package,
} from 'lucide-react'
import {
  getNfePedidos,
  aprovarNfePedido,
  rejeitarNfePedido,
  atualizarNfePedido,
  excluirNfePedido,
  getProdutosCatalogo,
  type NfePedido,
  type NfeStatus,
  type NfeItem,
  type ProdutoCatalogo,
} from '@/services/nfe-service'
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { useRealtimeData } from '@/hooks/useRealtimeData'

interface NfeReviewQueueProps {
  onPedidoAprovado?: () => void
  onOpenUpload?: () => void
}

export function NfeReviewQueue({ onPedidoAprovado, onOpenUpload }: NfeReviewQueueProps) {
  const [pedidos, setPedidos] = useState<NfePedido[]>([])
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoCatalogo[]>([])
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('pendente_all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal de Detalhes / Edição / Aprovação
  const [selectedPedido, setSelectedPedido] = useState<NfePedido | null>(null)
  const [editingData, setEditingData] = useState<Partial<NfePedido> | null>(null)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectMotivo, setRejectMotivo] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [list, prods, g, v] = await Promise.all([
        getNfePedidos('all'),
        getProdutosCatalogo().catch(() => []),
        getGestoresTecnicos().catch(() => []),
        getVendedoresGestao().catch(() => []),
      ])
      setPedidos(list)
      setProdutosCatalogo(prods)
      setGestores(g)
      setVendedores(v)
    } catch (err) {
      console.error('Erro ao carregar pedidos nfe:', err)
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtimeData('nfe_pedidos', loadData)
  useRealtimeData('notas_fiscais', loadData)
  useRealtimeData('nf_itens', loadData)

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      // Filtro de Status
      if (statusFilter === 'pendente_all') {
        if (
          p.status !== 'pendente' &&
          p.status !== 'pendencia_produto' &&
          p.status !== 'importada'
        ) {
          return false
        }
      } else if (statusFilter === 'pendente') {
        if (p.status !== 'pendente' && p.status !== 'importada') return false
      } else if (statusFilter !== 'all') {
        if (p.status !== statusFilter) return false
      }

      // Busca
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchNum = p.numero_nf?.toLowerCase().includes(q)
        const matchCli = p.cliente_nome?.toLowerCase().includes(q)
        const matchCnpj = p.cliente_cnpj?.includes(q)
        const matchArq = p.arquivo_nome?.toLowerCase().includes(q)
        if (!matchNum && !matchCli && !matchCnpj && !matchArq) return false
      }

      return true
    })
  }, [pedidos, statusFilter, searchTerm])

  const counts = useMemo(() => {
    const pendentes = pedidos.filter(
      (p) => p.status === 'pendente' || p.status === 'importada',
    ).length
    const pendenciaProd = pedidos.filter((p) => p.status === 'pendencia_produto').length
    const aprovados = pedidos.filter((p) => p.status === 'aprovado').length
    const totalPendentes = pendentes + pendenciaProd
    return { pendentes, pendenciaProd, aprovados, totalPendentes }
  }, [pedidos])

  const openReviewModal = (pedido: NfePedido) => {
    setSelectedPedido(pedido)
    setEditingData({
      cliente_nome: pedido.cliente_nome,
      cliente_cnpj: pedido.cliente_cnpj,
      cliente_cidade: pedido.cliente_cidade,
      cliente_uf: pedido.cliente_uf,
      numero_nf: pedido.numero_nf,
      data_emissao: pedido.data_emissao ? pedido.data_emissao.split('T')[0] : '',
      valor_total: pedido.valor_total,
      especie: pedido.especie || 'BOVINO',
      canal_vendas: pedido.canal_vendas || 'Direto',
      gestor_tecnico_id: pedido.gestor_tecnico_id,
      vendedor_id: pedido.vendedor_id,
      itens: JSON.parse(JSON.stringify(pedido.itens || [])),
      observacoes: pedido.observacoes,
    })
  }

  const handleApprove = async () => {
    if (!selectedPedido) return
    setApproving(true)
    try {
      const res = await aprovarNfePedido(selectedPedido.id, editingData || undefined)
      if (res.success) {
        toast.success('Pedido aprovado com sucesso!')
        setSelectedPedido(null)
        setEditingData(null)
        loadData()
        if (onPedidoAprovado) onPedidoAprovado()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Não foi possível salvar o pedido. Tente novamente.')
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!selectedPedido) return
    setRejecting(true)
    try {
      const res = await rejeitarNfePedido(selectedPedido.id, rejectMotivo)
      if (res.success) {
        toast.info('Nota fiscal rejeitada.')
        setRejectDialogOpen(false)
        setSelectedPedido(null)
        setEditingData(null)
        setRejectMotivo('')
        loadData()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao rejeitar nota fiscal')
    } finally {
      setRejecting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await excluirNfePedido(deletingId)
      toast.success('Registro excluído da fila')
      loadData()
    } catch {
      toast.error('Erro ao excluir')
    } finally {
      setDeletingId(null)
    }
  }

  // Atualizar item na edição
  const updateItemField = (idx: number, field: keyof NfeItem, value: any) => {
    if (!editingData?.itens) return
    const nextItens = [...editingData.itens]
    nextItens[idx] = { ...nextItens[idx], [field]: value }

    // Recalcular valor total do item se mudou quantidade ou unitário
    if (field === 'quantidade' || field === 'preco_unitario') {
      const qtd = field === 'quantidade' ? Number(value) : nextItens[idx].quantidade
      const pu = field === 'preco_unitario' ? Number(value) : nextItens[idx].preco_unitario
      nextItens[idx].valor_total = qtd * pu
    }

    // Se vinculou a um produto do catálogo
    if (field === 'produto_catalogo_id') {
      const prod = produtosCatalogo.find((p) => p.id === value)
      if (prod) {
        nextItens[idx].produto_catalogo_nome = prod.nome
        nextItens[idx].linha_produto = prod.linha
        nextItens[idx].reconhecido = true
      }
    }

    // Recalcular total geral
    const novoTotal = nextItens.reduce((s, it) => s + (it.valor_total || 0), 0)

    setEditingData({
      ...editingData,
      itens: nextItens,
      valor_total: novoTotal > 0 ? novoTotal : editingData.valor_total,
    })
  }

  const renderStatusBadge = (status: NfeStatus) => {
    switch (status) {
      case 'pendencia_produto':
        return (
          <Badge
            variant="outline"
            className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
            Com pendência de produto
          </Badge>
        )
      case 'pendente':
      case 'importada':
        return (
          <Badge
            variant="outline"
            className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400 gap-1"
          >
            <Clock className="w-3 h-3 text-blue-600 shrink-0" />
            Pendente de revisão
          </Badge>
        )
      case 'aprovado':
        return (
          <Badge
            variant="outline"
            className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1"
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            Aprovado
          </Badge>
        )
      case 'rejeitado':
        return (
          <Badge
            variant="outline"
            className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 gap-1"
          >
            <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
            Rejeitado
          </Badge>
        )
      case 'duplicada_ignorada':
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            Duplicada Ignorada
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Cards de Métricas da Fila */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          className={`shadow-subtle cursor-pointer transition-all border-l-4 ${
            statusFilter === 'pendente_all'
              ? 'border-l-primary bg-primary/5'
              : 'border-l-transparent'
          }`}
          onClick={() => setStatusFilter('pendente_all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Aguardando Revisão</p>
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <p className="text-2xl font-bold mt-1">{counts.totalPendentes}</p>
            <p className="text-[10px] text-muted-foreground">Exigem conferência humana</p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-subtle cursor-pointer transition-all border-l-4 ${
            statusFilter === 'pendencia_produto'
              ? 'border-l-amber-500 bg-amber-500/5'
              : 'border-l-transparent'
          }`}
          onClick={() => setStatusFilter('pendencia_produto')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Pendência de Produto</p>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{counts.pendenciaProd}</p>
            <p className="text-[10px] text-muted-foreground">Código/produto não catalogado</p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-subtle cursor-pointer transition-all border-l-4 ${
            statusFilter === 'aprovado'
              ? 'border-l-emerald-500 bg-emerald-500/5'
              : 'border-l-transparent'
          }`}
          onClick={() => setStatusFilter('aprovado')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">NFs Efetivadas</p>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{counts.aprovados}</p>
            <p className="text-[10px] text-muted-foreground">Integradas ao ecossistema</p>
          </CardContent>
        </Card>

        <Card
          className={`shadow-subtle cursor-pointer transition-all border-l-4 ${
            statusFilter === 'all' ? 'border-l-slate-500 bg-muted/30' : 'border-l-transparent'
          }`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Total de NFs Lidas</p>
              <Layers className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold mt-1">{pedidos.length}</p>
            <p className="text-[10px] text-muted-foreground">Histórico completo de leituras</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Ações */}
      <Card className="shadow-subtle">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por NF, cliente ou CNPJ..."
                className="pl-9 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente_all">Pendentes (Todas)</SelectItem>
                  <SelectItem value="pendente">Pendente Simples</SelectItem>
                  <SelectItem value="pendencia_produto">Com Pendência de Produto</SelectItem>
                  <SelectItem value="aprovado">Aprovadas</SelectItem>
                  <SelectItem value="rejeitado">Rejeitadas</SelectItem>
                  <SelectItem value="all">Todas as NFs</SelectItem>
                </SelectContent>
              </Select>

              {onOpenUpload && (
                <Button size="sm" onClick={onOpenUpload} className="gap-1.5 h-9 text-xs shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" /> Ler Mais NFs (PDF)
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela da Fila de Revisão */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Fila de Conferência e Aprovação de NFs
              </CardTitle>
              <CardDescription className="text-xs">
                {filteredPedidos.length} nota(s) encontrada(s) no filtro selecionado.
              </CardDescription>
            </div>
          </div>
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
                    <TableHead>NF</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Cliente / Razão Social</TableHead>
                    <TableHead>Local / CNPJ</TableHead>
                    <TableHead>Itens / Produtos</TableHead>
                    <TableHead>Frete</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPedidos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground h-32">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="w-8 h-8 text-muted-foreground/40" />
                          <p className="text-sm">
                            Nenhuma nota fiscal encontrada nesta visualização.
                          </p>
                          {onOpenUpload && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onOpenUpload}
                              className="mt-1 gap-1.5 text-xs"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-primary" /> Fazer Upload de NF
                              em PDF
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPedidos.map((p) => {
                      const itensList = p.itens || []
                      const hasPendingItem = itensList.some((it) => !it.reconhecido)

                      return (
                        <TableRow
                          key={p.id}
                          className={
                            p.status === 'pendencia_produto'
                              ? 'bg-amber-50/40 dark:bg-amber-950/10'
                              : ''
                          }
                        >
                          <TableCell className="font-semibold whitespace-nowrap">
                            <span className="text-primary font-mono">#{p.numero_nf || 'S/N'}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {p.data_emissao
                              ? new Date(p.data_emissao).toLocaleDateString('pt-BR')
                              : '—'}
                          </TableCell>
                          <TableCell className="font-medium max-w-[220px]">
                            <div className="truncate font-semibold">
                              {p.cliente_nome || 'Sem Razão Social'}
                            </div>
                            {p.expand?.factory_id && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> Vinculado ao cadastro do CRM
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px]">
                            <div>
                              {p.cliente_cidade
                                ? `${p.cliente_cidade}/${p.cliente_uf || ''}`
                                : p.cliente_uf || '—'}
                            </div>
                            <div className="text-[10px] font-mono">{p.cliente_cnpj || '—'}</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium">{itensList.length} item(ns)</span>
                              {hasPendingItem && (
                                <span
                                  className="text-amber-600 text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 rounded"
                                  title="Item não encontrado no catálogo"
                                >
                                  Item s/ catálogo
                                </span>
                              )}
                            </div>
                            {itensList[0] && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                {itensList[0].nome || 'Item sem descrição'}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                              {p.frete_modalidade || 'CIF'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary whitespace-nowrap">
                            {formatCurrency(p.valor_total || 0)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {renderStatusBadge(p.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant={
                                  p.status === 'pendente' ||
                                  p.status === 'pendencia_produto' ||
                                  p.status === 'importada'
                                    ? 'default'
                                    : 'outline'
                                }
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => openReviewModal(p)}
                              >
                                {p.status === 'pendente' ||
                                p.status === 'pendencia_produto' ||
                                p.status === 'importada' ? (
                                  <>
                                    <Edit className="w-3.5 h-3.5" /> Conferir / Aprovar
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3.5 h-3.5" /> Detalhes
                                  </>
                                )}
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Excluir da fila"
                                onClick={() => setDeletingId(p.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE REVISÃO E APROVAÇÃO DETALHADA */}
      <Dialog
        open={!!selectedPedido}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPedido(null)
            setEditingData(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    Conferência de Nota Fiscal #{selectedPedido?.numero_nf}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Confira todos os dados extraídos pelo leitor automático antes de aprovar a
                    implantação no sistema.
                  </DialogDescription>
                </div>
              </div>
              {selectedPedido && renderStatusBadge(selectedPedido.status)}
            </div>
          </DialogHeader>

          {selectedPedido && editingData && (
            <div className="space-y-5 pt-2">
              {/* Alerta de Pendência se houver */}
              {selectedPedido.motivo_pendencia && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 rounded-lg text-xs flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong className="block font-semibold">Pendência detectada:</strong>
                    <span>{selectedPedido.motivo_pendencia}</span>
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                      Vincule os itens aos produtos do catálogo abaixo ou edite os dados antes de
                      aprovar.
                    </p>
                  </div>
                </div>
              )}

              {/* Seção 1: Dados do Cliente e da NF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-muted/30 p-3.5 rounded-xl border">
                <div className="space-y-1">
                  <Label className="text-xs">Número da NF *</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={editingData.numero_nf || ''}
                    onChange={(e) => setEditingData({ ...editingData, numero_nf: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data de Emissão *</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={editingData.data_emissao || ''}
                    onChange={(e) =>
                      setEditingData({ ...editingData, data_emissao: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ / CPF</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={editingData.cliente_cnpj || ''}
                    onChange={(e) =>
                      setEditingData({ ...editingData, cliente_cnpj: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Razão Social / Cliente *</Label>
                  <Input
                    className="h-8 text-xs font-medium"
                    value={editingData.cliente_nome || ''}
                    onChange={(e) =>
                      setEditingData({ ...editingData, cliente_nome: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade / UF</Label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Cidade"
                      className="h-8 text-xs flex-1"
                      value={editingData.cliente_cidade || ''}
                      onChange={(e) =>
                        setEditingData({ ...editingData, cliente_cidade: e.target.value })
                      }
                    />
                    <Input
                      placeholder="UF"
                      className="h-8 text-xs w-14 font-mono uppercase"
                      value={editingData.cliente_uf || ''}
                      onChange={(e) =>
                        setEditingData({ ...editingData, cliente_uf: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Espécie *</Label>
                  <Select
                    value={editingData.especie || 'BOVINO'}
                    onValueChange={(v) => setEditingData({ ...editingData, especie: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOVINO">BOVINO</SelectItem>
                      <SelectItem value="SUINO">SUINO</SelectItem>
                      <SelectItem value="AVE">AVE</SelectItem>
                      <SelectItem value="PET">PET</SelectItem>
                      <SelectItem value="AQUA">AQUA</SelectItem>
                      <SelectItem value="OUTRO">OUTRO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Canal de Vendas</Label>
                  <Select
                    value={editingData.canal_vendas || 'Direto'}
                    onValueChange={(v) => setEditingData({ ...editingData, canal_vendas: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direto">Direto</SelectItem>
                      <SelectItem value="Distribuidor">Distribuidor</SelectItem>
                      <SelectItem value="Indústria">Indústria</SelectItem>
                      <SelectItem value="Premixera">Premixera</SelectItem>
                      <SelectItem value="Cooperativa">Cooperativa</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Vendedor Responsável</Label>
                  <Select
                    value={editingData.vendedor_id || 'none'}
                    onValueChange={(v) =>
                      setEditingData({
                        ...editingData,
                        vendedor_id: v === 'none' ? undefined : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum / Automático</SelectItem>
                      {vendedores.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seção 2: Itens e Produtos da NF */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-primary" /> Produtos e Itens Faturados
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {editingData.itens?.length || 0} item(ns)
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {editingData.itens?.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border text-xs space-y-2.5 ${
                        !item.reconhecido
                          ? 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20'
                          : 'bg-card'
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Código NF</Label>
                          <Input
                            className="h-7 text-xs font-mono"
                            value={item.codigo || ''}
                            onChange={(e) => updateItemField(idx, 'codigo', e.target.value)}
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <Label className="text-[10px] text-muted-foreground">
                            Descrição do Produto na NF
                          </Label>
                          <Input
                            className="h-7 text-xs font-medium"
                            value={item.nome || ''}
                            onChange={(e) => updateItemField(idx, 'nome', e.target.value)}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-muted-foreground">Qtd / Un</Label>
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              className="h-7 text-xs"
                              value={item.quantidade || 0}
                              onChange={(e) =>
                                updateItemField(idx, 'quantidade', parseFloat(e.target.value) || 0)
                              }
                            />
                            <Input
                              className="h-7 text-[10px] w-12 text-center uppercase"
                              value={item.unidade || 'KG'}
                              onChange={(e) => updateItemField(idx, 'unidade', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <Label className="text-[10px] text-muted-foreground">
                            Preço Unit. (R$)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 text-xs text-right"
                            value={item.preco_unitario || 0}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                'preco_unitario',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                          />
                        </div>

                        <div className="sm:col-span-2 text-right">
                          <Label className="text-[10px] text-muted-foreground">Total Item</Label>
                          <p className="font-bold text-primary text-xs py-1">
                            {formatCurrency(item.valor_total || 0)}
                          </p>
                        </div>
                      </div>

                      {/* Vínculo com catálogo */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-dashed">
                        <div className="flex items-center gap-1.5 flex-1 w-full">
                          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                            Vínculo Catálogo Blink:
                          </span>
                          <Select
                            value={item.produto_catalogo_id || 'none'}
                            onValueChange={(v) =>
                              updateItemField(idx, 'produto_catalogo_id', v === 'none' ? null : v)
                            }
                          >
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder="Selecione um produto do catálogo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                ⚠ Produto não catalogado (Personalizado)
                              </SelectItem>
                              {produtosCatalogo.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  [{cat.codigo}] {cat.nome} ({cat.linha || 'Geral'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {item.reconhecido ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] shrink-0"
                          >
                            Catálogo Reconhecido
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] shrink-0"
                          >
                            Sem vínculo
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seção 3: Impostos, Frete e Total Geral */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-3 rounded-lg border text-xs">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Frete & Modalidade
                  </p>
                  <p className="font-medium mt-1">
                    Modalidade:{' '}
                    <span className="font-bold">{selectedPedido.frete_modalidade || 'FOB'}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Valor: {formatCurrency(selectedPedido.frete_valor || 0)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" /> Impostos Destacados
                  </p>
                  <p className="text-muted-foreground mt-1">
                    ICMS: {formatCurrency(selectedPedido.impostos_icms_valor || 0)} (
                    {selectedPedido.impostos_icms_aliquota || 0}%)
                  </p>
                  <p className="text-muted-foreground">
                    PIS/COFINS:{' '}
                    {formatCurrency(
                      (selectedPedido.impostos_pis_valor || 0) +
                        (selectedPedido.impostos_cofins_valor || 0),
                    )}
                  </p>
                </div>

                <div className="flex flex-col justify-center sm:items-end bg-primary/10 p-2.5 rounded-md">
                  <p className="text-[11px] font-medium text-muted-foreground">Valor Total da NF</p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(editingData.valor_total || 0)}
                  </p>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-1">
                <Label className="text-xs">Observações / Histórico</Label>
                <Textarea
                  rows={2}
                  className="text-xs"
                  value={editingData.observacoes || ''}
                  onChange={(e) => setEditingData({ ...editingData, observacoes: e.target.value })}
                  placeholder="Informações adicionais do pedido..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-3 border-t">
            {selectedPedido &&
            (selectedPedido.status === 'pendente' ||
              selectedPedido.status === 'pendencia_produto' ||
              selectedPedido.status === 'importada') ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={approving || rejecting}
                  className="w-full sm:w-auto"
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Rejeitar Nota
                </Button>

                <div className="flex gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPedido(null)}
                    disabled={approving || rejecting}
                  >
                    Fechar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApprove}
                    disabled={approving || rejecting}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white min-w-[150px]"
                  >
                    {approving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Aprovar e Efetivar Pedido
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex justify-end w-full">
                <Button variant="outline" size="sm" onClick={() => setSelectedPedido(null)}>
                  Fechar
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE REJEIÇÃO COM MOTIVO */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Rejeitar Nota Fiscal #
              {selectedPedido?.numero_nf}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe o motivo da rejeição. A nota será desconsiderada da implantação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs">Motivo da Rejeição</Label>
            <Textarea
              rows={3}
              className="text-xs"
              placeholder="Ex: Nota fiscal cancelada, dados incorretos ou erro de faturamento..."
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejecting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleReject}
              disabled={rejecting}
              className="gap-1.5"
            >
              {rejecting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir da Fila de Revisão?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este registro da fila de revisão?
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
