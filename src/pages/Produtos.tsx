import React, { useState } from 'react'
import {
  Package,
  Plus,
  Search,
  RotateCcw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useProdutos } from '@/hooks/useProdutos'
import {
  CATEGORIAS_PRODUTO,
  LINHAS_PRODUTO,
  type Produto,
  type ProdutoFormData,
  type ProdutoUpdateFormData,
  CODIGO_PRODUTO_REGEX,
} from '@/services/produtos-service'

export function Produtos() {
  const { toast } = useToast()
  const {
    produtos,
    loading,
    error,
    totalPages,
    currentPage,
    totalItems,
    search,
    filterCategoria,
    filterLinha,
    showInactive,
    loadProdutos,
    createProduto,
    updateProduto,
    deactivateProduto,
    setPage,
    setSearch,
    setFilterCategoria,
    setFilterLinha,
    toggleShowInactive,
  } = useProdutos()

  // Modal Novo Produto
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createFormData, setCreateFormData] = useState<ProdutoFormData>({
    codigo: '',
    nome: '',
    categoria: 'Mycotoxin Binders',
    linha: 'MOS',
    ativo: true,
  })
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false)

  // Modal Editar Produto
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
  const [editFormData, setEditFormData] = useState<ProdutoUpdateFormData>({
    nome: '',
    categoria: 'Mycotoxin Binders',
    linha: 'MOS',
    ativo: true,
  })
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Modal Desativar (Soft Delete)
  const [deactivatingProduto, setDeactivatingProduto] = useState<Produto | null>(null)
  const [isSubmittingDeactivate, setIsSubmittingDeactivate] = useState(false)

  // Handlers para Create
  const handleOpenCreate = () => {
    setCreateFormData({
      codigo: '',
      nome: '',
      categoria: 'Mycotoxin Binders',
      linha: 'MOS',
      ativo: true,
    })
    setCreateErrors({})
    setIsCreateOpen(true)
  }

  const handleValidateCreate = (): boolean => {
    const errs: Record<string, string> = {}
    const cleanCodigo = createFormData.codigo.trim().toUpperCase()

    if (!cleanCodigo) {
      errs.codigo = 'Código é obrigatório.'
    } else if (!CODIGO_PRODUTO_REGEX.test(cleanCodigo)) {
      errs.codigo = 'Codigo invalido. Use o formato XXXX.XX000.'
    }

    if (!createFormData.nome.trim()) {
      errs.nome = 'Nome é obrigatório.'
    }

    setCreateErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!handleValidateCreate()) return

    setIsSubmittingCreate(true)
    try {
      await createProduto({
        ...createFormData,
        codigo: createFormData.codigo.trim().toUpperCase(),
        nome: createFormData.nome.trim(),
      })
      toast({
        title: 'Sucesso!',
        description: 'Produto cadastrado!',
      })
      setIsCreateOpen(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar produto.'
      toast({
        title: 'Erro ao cadastrar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingCreate(false)
    }
  }

  // Handlers para Edit
  const handleOpenEdit = (p: Produto) => {
    setEditingProduto(p)
    setEditFormData({
      nome: p.nome,
      categoria: (p.categoria as any) || 'Mycotoxin Binders',
      linha: (p.linha as any) || 'MOS',
      ativo: p.ativo !== false,
    })
    setEditErrors({})
  }

  const handleValidateEdit = (): boolean => {
    const errs: Record<string, string> = {}
    if (!editFormData.nome.trim()) {
      errs.nome = 'Nome é obrigatório.'
    }
    setEditErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduto || !handleValidateEdit()) return

    setIsSubmittingEdit(true)
    try {
      await updateProduto(editingProduto.id, {
        ...editFormData,
        nome: editFormData.nome.trim(),
      })
      toast({
        title: 'Sucesso!',
        description: 'Produto atualizado!',
      })
      setEditingProduto(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar produto.'
      toast({
        title: 'Erro ao atualizar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Handlers para Deactivate
  const handleConfirmDeactivate = async () => {
    if (!deactivatingProduto) return

    setIsSubmittingDeactivate(true)
    try {
      await deactivateProduto(deactivatingProduto.id)
      toast({
        title: 'Sucesso!',
        description: 'Produto desativado!',
      })
      setDeactivatingProduto(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desativar produto.'
      toast({
        title: 'Erro ao desativar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingDeactivate(false)
    }
  }

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* Header com Título e Botão Novo Produto */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Produtos Blink</h1>
            <Badge
              variant="outline"
              className="text-xs font-semibold bg-primary/10 text-primary border-primary/20"
            >
              Catálogo Oficial
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Gerencie o catálogo oficial de produtos, linhas e categorias da Blink Biotech.
          </p>
        </div>

        <Button onClick={handleOpenCreate} className="gap-2 h-11 px-5 shadow-sm min-h-[44px]">
          <Plus className="w-4 h-4" /> Novo Produto
        </Button>
      </div>

      {/* Barra de Filtros e Busca */}
      <Card className="shadow-subtle">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Campo de Busca Debouncada */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 min-h-[44px] text-sm"
              />
            </div>

            {/* Dropdown Categoria */}
            <div className="w-full sm:w-[220px]">
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="h-11 min-h-[44px] text-xs">
                  <SelectValue placeholder="Categoria: Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Todas as Categorias</SelectItem>
                  {CATEGORIAS_PRODUTO.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown Linha */}
            <div className="w-full sm:w-[180px]">
              <Select value={filterLinha} onValueChange={setFilterLinha}>
                <SelectTrigger className="h-11 min-h-[44px] text-xs">
                  <SelectValue placeholder="Linha: Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Todas as Linhas</SelectItem>
                  {LINHAS_PRODUTO.map((lin) => (
                    <SelectItem key={lin} value={lin}>
                      {lin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Ativo */}
            <div className="flex items-center gap-2 shrink-0 px-2 py-1 bg-muted/40 rounded-lg border h-11 min-h-[44px]">
              <Switch
                id="toggle-inactive"
                checked={showInactive}
                onCheckedChange={toggleShowInactive}
              />
              <Label
                htmlFor="toggle-inactive"
                className="text-xs font-medium cursor-pointer text-muted-foreground select-none"
              >
                {showInactive ? 'Exibindo inativos' : 'Apenas ativos'}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UX STATE 3: ERROR */}
      {error && !loading && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Erro ao carregar produtos.</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Não foi possível consultar os registros no momento. Tente novamente.
              </p>
            </div>
            <Button variant="outline" onClick={loadProdutos} className="h-11 min-h-[44px] gap-2">
              <RotateCcw className="w-4 h-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* UX STATE 1: LOADING SKELETON (5 linhas com animação pulse) */}
      {loading && (
        <Card className="shadow-subtle">
          <CardContent className="p-4 sm:p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 animate-pulse gap-4"
              >
                <div className="flex items-center gap-3 w-1/3">
                  <Skeleton className="w-10 h-10 rounded" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-4 flex-1 justify-around">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-9 rounded" />
                  <Skeleton className="h-9 w-9 rounded" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* UX STATE 2: EMPTY STATE */}
      {!loading && !error && produtos.length === 0 && (
        <Card className="shadow-subtle border-dashed">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Package className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Nenhum produto encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Cadastre seu primeiro produto ou ajuste os filtros.
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="h-11 min-h-[44px] gap-2 mt-2">
              <Plus className="w-4 h-4" /> Novo Produto
            </Button>
          </CardContent>
        </Card>
      )}

      {/* UX STATE 4: SUCCESS LIST / TABLE (Fade-in ao carregar) */}
      {!loading && !error && produtos.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          {/* Visualização Desktop (Table >= 768px) */}
          <div className="hidden md:block">
            <Card className="shadow-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[160px]">Código</TableHead>
                      <TableHead className="min-w-[240px]">Nome</TableHead>
                      <TableHead className="w-[140px]">Linha</TableHead>
                      <TableHead className="w-[180px]">Categoria</TableHead>
                      <TableHead className="w-[100px] text-center">Ativo</TableHead>
                      <TableHead className="w-[120px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((p) => (
                      <TableRow
                        key={p.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          !p.ativo ? 'opacity-60 bg-muted/10' : ''
                        }`}
                      >
                        <TableCell className="font-mono font-semibold text-primary text-xs">
                          {p.codigo}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{p.nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium text-xs bg-muted/40">
                            {p.linha}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="font-normal text-xs bg-primary/10 text-primary border-primary/20"
                          >
                            {p.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {p.ativo ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] gap-1 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-muted-foreground text-[11px]"
                            >
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenEdit(p)}
                              className="h-9 w-9 text-muted-foreground hover:text-foreground"
                              title="Editar Produto"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {p.ativo && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeactivatingProduto(p)}
                                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                title="Desativar Produto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Visualização Mobile (Cards < 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {produtos.map((p) => (
              <Card
                key={p.id}
                className={`shadow-subtle transition-all ${
                  !p.ativo ? 'opacity-65 bg-muted/10' : 'bg-card'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary block">
                        {p.codigo}
                      </span>
                      <h4 className="font-semibold text-foreground text-sm mt-0.5">{p.nome}</h4>
                    </div>
                    {p.ativo ? (
                      <Badge className="bg-emerald-500 text-white text-[10px] gap-1 shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Ativo
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0 text-muted-foreground"
                      >
                        Inativo
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="outline" className="text-[11px] bg-muted/40">
                      Linha: {p.linha}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-[11px] bg-primary/10 text-primary border-primary/20"
                    >
                      {p.categoria}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(p)}
                      className="h-11 min-h-[44px] px-3 text-xs gap-1.5 flex-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </Button>
                    {p.ativo && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeactivatingProduto(p)}
                        className="h-11 min-h-[44px] px-3 text-xs gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Desativar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-card border shadow-subtle">
            <p className="text-xs text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{produtos.length}</span> de{' '}
              <span className="font-medium text-foreground">{totalItems}</span> produtos (Página{' '}
              <span className="font-medium text-foreground">{currentPage}</span> de{' '}
              <span className="font-medium text-foreground">{totalPages}</span>)
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || loading}
                className="h-11 min-h-[44px] px-3 gap-1 text-xs"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || loading}
                className="h-11 min-h-[44px] px-3 gap-1 text-xs"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO PRODUTO */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSaveCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Cadastrar Novo Produto
              </DialogTitle>
              <DialogDescription>
                Informe o código, nome, linha e categoria conforme a especificação Blink.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Código */}
              <div className="space-y-1.5">
                <Label htmlFor="create-codigo" className="text-xs font-semibold">
                  Código <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="create-codigo"
                  placeholder="Ex: BBMO.BE001, BPMI.OR001"
                  className={`h-11 min-h-[44px] font-mono text-xs uppercase ${
                    createErrors.codigo ? 'border-destructive ring-1 ring-destructive' : ''
                  }`}
                  value={createFormData.codigo}
                  onChange={(e) =>
                    setCreateFormData((prev) => ({
                      ...prev,
                      codigo: e.target.value.toUpperCase(),
                    }))
                  }
                />
                {createErrors.codigo ? (
                  <p className="text-[11px] text-destructive">{createErrors.codigo}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Formato: 3-4 letras, ponto, 2 letras e 3 números (ex: BPMI.OR001)
                  </p>
                )}
              </div>

              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="create-nome" className="text-xs font-semibold">
                  Nome do Produto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="create-nome"
                  placeholder="Ex: Blink Calcium 17 - SC"
                  className={`h-11 min-h-[44px] text-sm ${
                    createErrors.nome ? 'border-destructive ring-1 ring-destructive' : ''
                  }`}
                  value={createFormData.nome}
                  onChange={(e) => setCreateFormData((prev) => ({ ...prev, nome: e.target.value }))}
                />
                {createErrors.nome && (
                  <p className="text-[11px] text-destructive">{createErrors.nome}</p>
                )}
              </div>

              {/* Linha (Select 5 opções) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Linha <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={createFormData.linha}
                  onValueChange={(val: any) =>
                    setCreateFormData((prev) => ({ ...prev, linha: val }))
                  }
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINHAS_PRODUTO.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria (Select 5 opções) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Categoria <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={createFormData.categoria}
                  onValueChange={(val: any) =>
                    setCreateFormData((prev) => ({ ...prev, categoria: val }))
                  }
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_PRODUTO.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggle Ativo */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="create-ativo" className="text-xs font-medium cursor-pointer">
                    Produto Ativo
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Produtos ativos ficam disponíveis para pedidos e faturamento.
                  </p>
                </div>
                <Switch
                  id="create-ativo"
                  checked={createFormData.ativo}
                  onCheckedChange={(checked) =>
                    setCreateFormData((prev) => ({ ...prev, ativo: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="h-11 min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCreate}
                className="h-11 min-h-[44px] gap-2"
              >
                {isSubmittingCreate ? 'Salvando...' : 'Cadastrar Produto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDITAR PRODUTO */}
      <Dialog open={!!editingProduto} onOpenChange={(open) => !open && setEditingProduto(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" /> Editar Produto
              </DialogTitle>
              <DialogDescription>
                Atualize as informações do produto. O código não pode ser alterado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Código (Readonly) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Código</Label>
                <Input
                  disabled
                  value={editingProduto?.codigo || ''}
                  className="h-11 min-h-[44px] font-mono text-xs bg-muted cursor-not-allowed uppercase"
                />
              </div>

              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-nome" className="text-xs font-semibold">
                  Nome do Produto <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-nome"
                  className={`h-11 min-h-[44px] text-sm ${
                    editErrors.nome ? 'border-destructive ring-1 ring-destructive' : ''
                  }`}
                  value={editFormData.nome}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, nome: e.target.value }))}
                />
                {editErrors.nome && (
                  <p className="text-[11px] text-destructive">{editErrors.nome}</p>
                )}
              </div>

              {/* Linha (Select) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Linha <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={editFormData.linha}
                  onValueChange={(val: any) => setEditFormData((prev) => ({ ...prev, linha: val }))}
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINHAS_PRODUTO.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Categoria (Select) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Categoria <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={editFormData.categoria}
                  onValueChange={(val: any) =>
                    setEditFormData((prev) => ({ ...prev, categoria: val }))
                  }
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_PRODUTO.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggle Ativo */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-ativo" className="text-xs font-medium cursor-pointer">
                    Produto Ativo
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Desative caso o produto tenha sido descontinuado.
                  </p>
                </div>
                <Switch
                  id="edit-ativo"
                  checked={editFormData.ativo}
                  onCheckedChange={(checked) =>
                    setEditFormData((prev) => ({ ...prev, ativo: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingProduto(null)}
                className="h-11 min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmittingEdit} className="h-11 min-h-[44px] gap-2">
                {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFIRMAÇÃO DE DESATIVAÇÃO (SOFT DELETE) */}
      <AlertDialog
        open={!!deactivatingProduto}
        onOpenChange={(open) => !open && setDeactivatingProduto(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar este produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto{' '}
              <strong className="text-foreground">
                {deactivatingProduto?.nome} ({deactivatingProduto?.codigo})
              </strong>{' '}
              será marcado como inativo e não aparecerá nas listagens padrão de pedidos. Você poderá
              reativá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-11 min-h-[44px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeactivate}
              disabled={isSubmittingDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-11 min-h-[44px]"
            >
              {isSubmittingDeactivate ? 'Desativando...' : 'Desativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Produtos
