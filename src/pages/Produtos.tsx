import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Layers,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useGlobalData } from '@/store/GlobalDataProvider'
import {
  FAMILIAS_CATALOGO,
  FAMILIA_ROTULOS,
  formatarFamilia,
  derivarFamiliaPorCodigo,
  produtosService,
  type Produto,
  type ProdutoFormData,
  type FamiliaCatalogo,
} from '@/services/produtos-service'

export function Produtos() {
  const { produtos, produtosState, refreshCollection, notifyDataChanged } = useGlobalData()

  const loading = produtosState.loading
  const error = Boolean(produtosState.error)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [familiaFilter, setFamiliaFilter] = useState('all')

  // Debounce da busca
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadProdutos = async () => {
    await refreshCollection('produtos')
  }

  const createProduto = async (data: ProdutoFormData): Promise<Produto> => {
    const created = await produtosService.createProduto(data)
    notifyDataChanged('produtos')
    await refreshCollection('produtos')
    return created
  }

  const updateProduto = async (id: string, data: ProdutoFormData): Promise<Produto> => {
    const updated = await produtosService.updateProduto(id, data)
    notifyDataChanged('produtos')
    await refreshCollection('produtos')
    return updated
  }

  const deleteProduto = async (id: string): Promise<boolean> => {
    const res = await produtosService.deleteProduto(id)
    notifyDataChanged('produtos')
    await refreshCollection('produtos')
    return res
  }

  // Modal de Criação / Edição
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
  const [formData, setFormData] = useState<ProdutoFormData>({
    codigo: '',
    nome: '',
  })
  const [formErrors, setFormErrors] = useState<{ codigo?: string; nome?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Diálogo de confirmação de exclusão
  const [deletingProduto, setDeletingProduto] = useState<Produto | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  // Família derivada dinamicamente para o formulário
  const familiaDerivada = useMemo(() => {
    return derivarFamiliaPorCodigo(formData.codigo)
  }, [formData.codigo])

  // Filtragem local adicional se necessário (mantendo sincronia instantânea)
  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      // Busca debouncada por código ou nome
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim()
        const codeMatch = (p.codigo || '').toLowerCase().includes(q)
        const nameMatch = (p.nome || '').toLowerCase().includes(q)
        if (!codeMatch && !nameMatch) return false
      }

      // Filtro por Família
      if (familiaFilter !== 'all') {
        const famCode = derivarFamiliaPorCodigo(p.codigo) || p.familia || ''
        const famCodeUpper = famCode.toUpperCase().trim()
        const targetUpper = familiaFilter.toUpperCase().trim()
        const rotulo = FAMILIA_ROTULOS[targetUpper as FamiliaCatalogo] || ''
        const rotuloUpper = rotulo.toUpperCase().trim()

        if (
          famCodeUpper !== targetUpper &&
          !famCodeUpper.includes(targetUpper) &&
          (!rotuloUpper || !famCodeUpper.includes(rotuloUpper))
        ) {
          return false
        }
      }

      return true
    })
  }, [produtos, debouncedSearch, familiaFilter])

  // Abertura do formulário para novo produto
  const handleOpenNew = () => {
    setEditingProduto(null)
    setFormData({
      codigo: '',
      nome: '',
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  // Abertura do formulário para edição
  const handleOpenEdit = (p: Produto) => {
    setEditingProduto(p)
    setFormData({
      codigo: p.codigo,
      nome: p.nome,
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  // Validação inline
  const validateForm = async (): Promise<boolean> => {
    const errs: { codigo?: string; nome?: string } = {}
    const cleanCodigo = formData.codigo.trim().toUpperCase()
    const cleanNome = formData.nome.trim()

    if (!cleanCodigo) {
      errs.codigo = 'Informe o código'
    } else {
      // Verificar unicidade de código
      const exists = await produtosService.checkCodigoExistente(cleanCodigo, editingProduto?.id)
      if (exists) {
        errs.codigo = 'Código já cadastrado'
      }
    }

    if (!cleanNome) {
      errs.nome = 'Informe o nome'
    }

    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Salvar formulário (Create ou Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const isValid = await validateForm()
      if (!isValid) {
        setIsSubmitting(false)
        return
      }

      const cleanCodigo = formData.codigo.trim().toUpperCase()
      const cleanNome = formData.nome.trim()

      if (editingProduto) {
        await updateProduto(editingProduto.id, {
          codigo: cleanCodigo,
          nome: cleanNome,
        })
      } else {
        await createProduto({
          codigo: cleanCodigo,
          nome: cleanNome,
        })
      }

      toast.success('Produto salvo com sucesso.')
      setDialogOpen(false)
      setEditingProduto(null)
    } catch (err: any) {
      console.error('[Produtos] Erro ao salvar:', err)
      const msg = err?.message || 'Erro ao salvar produto'
      if (msg.includes('Código já cadastrado')) {
        setFormErrors((prev) => ({ ...prev, codigo: 'Código já cadastrado' }))
      } else if (msg.includes('Informe o código')) {
        setFormErrors((prev) => ({ ...prev, codigo: 'Informe o código' }))
      } else if (msg.includes('Informe o nome')) {
        setFormErrors((prev) => ({ ...prev, nome: 'Informe o nome' }))
      } else {
        toast.error(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirmação de exclusão
  const handleConfirmDelete = async () => {
    if (!deletingProduto) return
    setDeletePending(true)
    try {
      await deleteProduto(deletingProduto.id)
      toast.success('Produto excluído com sucesso.')
      setDeletingProduto(null)
    } catch (err: any) {
      console.error('[Produtos] Erro ao excluir produto:', err)
      toast.error('Erro ao excluir produto. Tente novamente.')
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra superior de Ações e Filtros (mesmo padrão visual do ClientesManager) */}
      <Card className="shadow-subtle border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Catálogo de Produtos
              </CardTitle>
              <CardDescription>
                Gerencie o catálogo oficial de produtos Blink, códigos e famílias de produtos.
              </CardDescription>
            </div>
            <Button onClick={handleOpenNew} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Novo Produto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Input de busca por código ou nome com debounce */}
            <div className="md:col-span-8 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Dropdown de filtro por Família */}
            <div className="md:col-span-4">
              <Select value={familiaFilter} onValueChange={setFamiliaFilter}>
                <SelectTrigger aria-label="Filtrar por Família">
                  <SelectValue placeholder="Família: Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Família: Todas</SelectItem>
                  {FAMILIAS_CATALOGO.map((fam) => (
                    <SelectItem key={fam} value={fam}>
                      {fam} · {FAMILIA_ROTULOS[fam]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ESTADO 1: ERROR */}
      {error && !loading && (
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-destructive/10 rounded-full text-destructive">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Não foi possível carregar os produtos
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Ocorreu uma falha na comunicação com o banco de dados. Verifique sua conexão e tente
                novamente.
              </p>
            </div>
            <Button onClick={loadProdutos} variant="outline" className="gap-2 mt-2">
              <RotateCcw className="w-4 h-4" /> Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {/* ESTADO 2: LOADING (Skeleton rows imitando a tabela) */}
      {loading && (
        <Card className="shadow-subtle border-border">
          <div className="p-4 border-b">
            <Skeleton className="h-5 w-48" />
          </div>
          {/* Skeleton para Desktop (Tabela) */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[130px]">Família</TableHead>
                  <TableHead className="w-[180px]">Perfil do Produto</TableHead>
                  <TableHead className="text-right w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Skeleton para Mobile (Cards) */}
          <div className="md:hidden p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-border bg-card space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-28" />
                </div>
              </div>
            ))}
          </div>{' '}
        </Card>
      )}

      {/* ESTADO 3: EMPTY */}
      {!loading && !error && produtos.length === 0 && (
        <Card className="border-dashed p-12 text-center shadow-subtle">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <Package className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhum produto cadastrado</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Cadastre o primeiro produto para iniciar a gestão do catálogo da Blink.
            </p>
            <Button onClick={handleOpenNew} className="gap-2 mt-3">
              <Plus className="w-4 h-4" /> Cadastrar produto
            </Button>
          </div>
        </Card>
      )}

      {/* ESTADO 4: SUCESSO / LISTAGEM COM DADOS */}
      {!loading && !error && produtos.length > 0 && (
        <Card className="shadow-subtle border-border">
          <div className="px-6 py-3 border-b flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredProdutos.length} produto(s) encontrado(s) de um total de {produtos.length}
            </span>
            {(searchTerm || familiaFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setSearchTerm('')
                  setFamiliaFilter('all')
                }}
              >
                <RotateCcw className="w-3 h-3" /> Limpar filtros
              </Button>
            )}
          </div>

          {filteredProdutos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum produto atende aos filtros selecionados.
            </div>
          ) : (
            <>
              {/* VISUALIZAÇÃO DESKTOP: TABELA (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[130px]">Família</TableHead>
                      <TableHead className="w-[180px]">Perfil do Produto</TableHead>
                      <TableHead className="text-right w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProdutos.map((p) => {
                      const famCode = derivarFamiliaPorCodigo(p.codigo) || p.familia || ''
                      const rotulo = famCode
                        ? FAMILIA_ROTULOS[famCode as FamiliaCatalogo]
                        : undefined
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono font-semibold text-foreground text-sm">
                            {p.codigo}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{p.nome}</TableCell>
                          <TableCell>
                            {famCode ? (
                              <Badge variant="secondary" className="font-medium text-xs">
                                <span className="font-mono font-bold text-primary">{famCode}</span>
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-foreground">{rotulo || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(p)}
                                title="Editar produto"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingProduto(p)}
                                className="text-destructive hover:text-destructive"
                                title="Excluir produto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* VISUALIZAÇÃO RESPONSIVA MOBILE: CARDS (< 768px) */}
              <div className="md:hidden p-4 space-y-3">
                {filteredProdutos.map((p) => {
                  const famCode = derivarFamiliaPorCodigo(p.codigo) || p.familia || ''
                  const rotulo = famCode ? FAMILIA_ROTULOS[famCode as FamiliaCatalogo] : undefined
                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-lg border border-border bg-card space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-mono font-bold text-primary block">
                            {p.codigo}
                          </span>
                          <h4 className="font-semibold text-foreground text-base leading-tight mt-0.5">
                            {p.nome}
                          </h4>
                        </div>
                        {famCode ? (
                          <Badge
                            variant="secondary"
                            className="text-xs font-semibold shrink-0 font-mono text-primary"
                          >
                            {famCode}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs shrink-0">—</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-muted-foreground">Perfil do Produto:</span>
                        <span className="font-medium text-foreground">{rotulo || '—'}</span>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => handleOpenEdit(p)}
                        >
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                          onClick={() => setDeletingProduto(p)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>{' '}
            </>
          )}
        </Card>
      )}

      {/* MODAL: NOVO PRODUTO / EDITAR PRODUTO */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingProduto ? (
                  <>
                    <Edit className="w-5 h-5 text-primary" /> Editar Produto
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-primary" /> Novo Produto
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {editingProduto
                  ? 'Atualize os dados do produto no catálogo.'
                  : 'Preencha os campos para cadastrar um novo produto no catálogo.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Campo Código */}
              <div className="space-y-1.5">
                <Label htmlFor="prod-codigo" className="text-xs font-semibold">
                  Código <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-codigo"
                  placeholder="Ex: BBMO.BE001"
                  value={formData.codigo}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase()
                    setFormData((prev) => ({ ...prev, codigo: val }))
                    if (formErrors.codigo) {
                      setFormErrors((prev) => ({ ...prev, codigo: undefined }))
                    }
                  }}
                  className={`font-mono uppercase text-sm ${
                    formErrors.codigo ? 'border-destructive ring-1 ring-destructive' : ''
                  }`}
                />
                {formErrors.codigo && (
                  <p className="text-xs text-destructive">{formErrors.codigo}</p>
                )}
              </div>

              {/* Campo Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="prod-nome" className="text-xs font-semibold">
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-nome"
                  placeholder="Ex: Blink Mos - SC"
                  value={formData.nome}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, nome: e.target.value }))
                    if (formErrors.nome) {
                      setFormErrors((prev) => ({ ...prev, nome: undefined }))
                    }
                  }}
                  className={`text-sm ${
                    formErrors.nome ? 'border-destructive ring-1 ring-destructive' : ''
                  }`}
                />
                {formErrors.nome && <p className="text-xs text-destructive">{formErrors.nome}</p>}
              </div>

              {/* Família Exibida Automaticamente (Derivada) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Família (calculada automaticamente)
                  </Label>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" /> Derivada do prefixo
                  </span>
                </div>
                <div className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {familiaDerivada ? (
                      formatarFamilia(familiaDerivada)
                    ) : (
                      <span className="text-muted-foreground text-xs italic">
                        Informe o código com prefixo válido (BBMI.XS, BBMO.BE, BBMY.CO, BPMI.OR,
                        BPMY.ST)
                      </span>
                    )}
                  </span>
                  {familiaDerivada && (
                    <Badge variant="outline" className="text-xs bg-background font-mono">
                      {familiaDerivada}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting
                  ? 'Salvando...'
                  : editingProduto
                    ? 'Salvar Alterações'
                    : 'Cadastrar Produto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog
        open={!!deletingProduto}
        onOpenChange={(open) => {
          if (!open) setDeletingProduto(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o produto{' '}
              <strong className="text-foreground">
                {deletingProduto?.nome} ({deletingProduto?.codigo})
              </strong>{' '}
              do catálogo. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={deletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Produtos
