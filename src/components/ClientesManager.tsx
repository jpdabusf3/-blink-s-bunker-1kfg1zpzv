import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Users,
  MapPin,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { getAllFactories, deleteFactoryPB } from '@/services/factories'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { useAuth } from '@/hooks/use-auth'
import { useUsers } from '@/hooks/use-users'
import { getScopedFactories } from '@/lib/user-scope'
import { useRealtime } from '@/hooks/use-realtime'
import { useAppContext } from '@/store/AppContext'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import { logActivity } from '@/services/activity-logs'
import { ClienteFormDialog } from '@/components/ClienteFormDialog'
import { formatCNPJ, cleanDigits, BRAZILIAN_UFS, CLIENT_SEGMENTOS } from '@/lib/cnpj'
import {
  buildUnifiedVendedoresList,
  factoryMatchesVendedor,
  type UnifiedVendedorOption,
} from '@/lib/vendedorFilterHelper'
import type { Factory } from '@/types'

export function ClientesManager() {
  const { user } = useAuth()
  const { users } = useUsers()
  const { deleteFactory: deleteFactoryStore } = useAppContext()
  const { logAction } = useFunnelActivityLog()

  const [clientes, setClientes] = useState<Factory[]>([])
  const [gestaoTecnicaList, setGestaoTecnicaList] = useState<GestaoTecnica[]>([])

  // Estados da tela: loading, error
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [segmentoFilter, setSegmentoFilter] = useState<string>('all')
  const [ufFilter, setUfFilter] = useState<string>('all')
  const [vendedorFilter, setVendedorFilter] = useState<string>('all')

  // Modal de criação / edição
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Factory | null>(null)

  // Diálogo de confirmação de exclusão
  const [deletingCliente, setDeletingCliente] = useState<Factory | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  // Debounce de 300ms para a busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Carga inicial e retry
  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [all, gestao] = await Promise.all([
        getAllFactories(),
        getGestaoTecnica().catch(() => [] as GestaoTecnica[]),
      ])
      const scoped = getScopedFactories(all, user)
      setClientes(scoped)
      setGestaoTecnicaList(gestao)
    } catch (err) {
      console.error('[ClientesManager] Erro ao carregar clientes:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime updates
  const handleRealtimeChange = useCallback(() => {
    loadData()
  }, [loadData])

  useRealtime('factories', handleRealtimeChange)
  useRealtime('gestao_tecnica', handleRealtimeChange)

  // Escuta evento global de sync (GlobalDataProvider)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleGlobalSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity?: string; collection?: string }>
      const col = customEvent.detail?.collection || customEvent.detail?.entity || 'all'
      if (col === 'all' || col === 'factories' || col === 'clientes') {
        void loadData()
      }
    }
    window.addEventListener('blink:datasync', handleGlobalSync)
    return () => {
      window.removeEventListener('blink:datasync', handleGlobalSync)
    }
  }, [loadData])

  // Lista unificada de opções de vendedores
  const vendedorOptions = useMemo<UnifiedVendedorOption[]>(() => {
    return buildUnifiedVendedoresList(gestaoTecnicaList, users)
  }, [gestaoTecnicaList, users])

  // Mapa de IDs de vendedor para nome
  const vendedorMap = useMemo(() => {
    const map = new Map<string, string>()
    gestaoTecnicaList.forEach((m) => {
      if (m.id && m.nome) map.set(m.id, m.nome)
    })
    return map
  }, [gestaoTecnicaList])

  // Filtragem
  const filteredClientes = useMemo(() => {
    return clientes.filter((c) => {
      // Busca por nome ou CNPJ
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim()
        const qDigits = cleanDigits(debouncedSearch)
        const nameMatch = (c.name || '').toLowerCase().includes(q)
        const cnpjClean = cleanDigits(c.cnpj)
        const cnpjMatch =
          cnpjClean.includes(q) || (qDigits.length > 0 && cnpjClean.includes(qDigits))
        if (!nameMatch && !cnpjMatch) {
          return false
        }
      }

      // Filtro por Segmento (compara com c.carteira)
      if (segmentoFilter !== 'all') {
        const seg = (c.carteira || '').trim().toUpperCase()
        if (seg !== segmentoFilter) {
          return false
        }
      }

      // Filtro por UF (compara com c.state)
      if (ufFilter !== 'all') {
        const uf = (c.state || '').trim().toUpperCase()
        if (uf !== ufFilter) {
          return false
        }
      }

      // Filtro por Vendedor
      if (vendedorFilter !== 'all') {
        if (!factoryMatchesVendedor(c, vendedorFilter, vendedorOptions)) {
          return false
        }
      }

      return true
    })
  }, [clientes, debouncedSearch, segmentoFilter, ufFilter, vendedorFilter, vendedorOptions])

  // Abertura do formulário
  const handleOpenNew = () => {
    setEditingCliente(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (cliente: Factory) => {
    setEditingCliente(cliente)
    setDialogOpen(true)
  }

  // Execução da exclusão
  const handleConfirmDelete = async () => {
    if (!deletingCliente) return
    setDeletePending(true)
    try {
      await deleteFactoryPB(deletingCliente.id)
      deleteFactoryStore(deletingCliente.id)
      setClientes((prev) => prev.filter((c) => c.id !== deletingCliente.id))

      logActivity(
        `Cliente excluído: ${deletingCliente.name}`,
        `ID: ${deletingCliente.id}, CNPJ: ${formatCNPJ(deletingCliente.cnpj) || '-'}`,
        deletingCliente.id,
        'factories',
      ).catch(() => {})

      logAction({
        action_type: 'delete',
        entity_type: 'client',
        entity_id: deletingCliente.id,
        entity_name: deletingCliente.name || deletingCliente.id,
        description: `Excluiu cliente ${deletingCliente.name || deletingCliente.id}`,
      })

      toast.success('Cliente excluído.')
      setDeletingCliente(null)
    } catch (err: any) {
      console.error('[ClientesManager] Erro ao excluir cliente:', err)
      toast.error('Erro ao excluir cliente. Tente novamente.')
    } finally {
      setDeletePending(false)
    }
  }

  const getVendedorDisplay = (c: Factory): string => {
    if (c.vendedor_name && c.vendedor_name.trim()) return c.vendedor_name
    if (c.vendedor_id && vendedorMap.has(c.vendedor_id)) {
      return vendedorMap.get(c.vendedor_id)!
    }
    if (c.expand?.vendedor_id?.nome) return c.expand.vendedor_id.nome
    if (c.expand?.vendedor?.nome) return c.expand.vendedor.nome
    return 'Não atribuído'
  }

  const getCidadeUfDisplay = (c: Factory): string => {
    const parts = [c.city?.trim(), c.state?.trim()?.toUpperCase()].filter(Boolean)
    return parts.length > 0 ? parts.join('/') : '-'
  }

  return (
    <div className="space-y-6">
      {/* Barra superior de Ações e Filtros */}
      <Card className="shadow-subtle border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Clientes
              </CardTitle>
              <CardDescription>
                Gerencie todos os clientes, dados cadastrais, segmentos e carteira comercial.
              </CardDescription>
            </div>
            <Button onClick={handleOpenNew} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Novo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Input de busca por nome ou CNPJ com debounce */}
            <div className="md:col-span-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por Razão Social ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Dropdown de filtro por Segmento */}
            <div className="md:col-span-3">
              <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
                <SelectTrigger aria-label="Filtrar por Segmento">
                  <SelectValue placeholder="Segmento: Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Segmento: Todos</SelectItem>
                  {CLIENT_SEGMENTOS.map((seg) => (
                    <SelectItem key={seg} value={seg}>
                      {seg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown de filtro por UF */}
            <div className="md:col-span-3">
              <Select value={ufFilter} onValueChange={setUfFilter}>
                <SelectTrigger aria-label="Filtrar por UF">
                  <SelectValue placeholder="UF: Todas" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="all">UF: Todas</SelectItem>
                  {BRAZILIAN_UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown de filtro por Vendedor */}
            <div className="md:col-span-3">
              <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                <SelectTrigger aria-label="Filtrar por Vendedor">
                  <SelectValue placeholder="Todos os vendedores" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todos os vendedores</SelectItem>
                  {vendedorOptions.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ESTADO 1: ERROR */}
      {loadError && (
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-destructive/10 rounded-full text-destructive">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Não foi possível carregar os clientes
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Ocorreu uma falha na comunicação com o banco de dados. Verifique sua conexão e tente
                novamente.
              </p>
            </div>
            <Button onClick={loadData} variant="outline" className="gap-2 mt-2">
              <RotateCcw className="w-4 h-4" /> Tentar novamente
            </Button>
          </div>
        </Card>
      )}

      {/* ESTADO 2: LOADING (Skeletons) */}
      {!loadError && loading && (
        <Card className="shadow-subtle border-border">
          <div className="p-4 border-b">
            <Skeleton className="h-5 w-48" />
          </div>
          {/* Skeleton para Desktop (Tabela) */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
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
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex justify-between items-center pt-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ESTADO 3: EMPTY */}
      {!loadError && !loading && clientes.length === 0 && (
        <Card className="border-dashed p-12 text-center shadow-subtle">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <FolderOpen className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhum cliente cadastrado</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Cadastre o primeiro cliente da sua carteira para gerenciar contatos, segmentos e
              oportunidades.
            </p>
            <Button onClick={handleOpenNew} className="gap-2 mt-3">
              <Plus className="w-4 h-4" /> Cadastrar cliente
            </Button>
          </div>
        </Card>
      )}

      {/* ESTADO 4: SUCESSO / LISTAGEM COM DADOS */}
      {!loadError && !loading && clientes.length > 0 && (
        <Card className="shadow-subtle border-border">
          <div className="px-6 py-3 border-b flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredClientes.length} cliente(s) encontrado(s) de um total de {clientes.length}
            </span>
            {(searchTerm ||
              segmentoFilter !== 'all' ||
              ufFilter !== 'all' ||
              vendedorFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setSearchTerm('')
                  setSegmentoFilter('all')
                  setUfFilter('all')
                  setVendedorFilter('all')
                }}
              >
                <RotateCcw className="w-3 h-3" /> Limpar filtros
              </Button>
            )}
          </div>

          {filteredClientes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum cliente atende aos filtros selecionados.
            </div>
          ) : (
            <>
              {/* VISUALIZAÇÃO DESKTOP: TABELA (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((c) => {
                      const seg = c.carteira?.trim().toUpperCase()
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-foreground">
                            <div>
                              <span>{c.name}</span>
                              {c.contato && (
                                <span className="block text-xs text-muted-foreground font-normal">
                                  Contato: {c.contato}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {formatCNPJ(c.cnpj) || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-sm">{getCidadeUfDisplay(c)}</TableCell>
                          <TableCell>
                            {seg ? (
                              <Badge variant="secondary" className="font-semibold text-xs">
                                {seg}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getVendedorDisplay(c)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(c)}
                                title="Editar cliente"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingCliente(c)}
                                className="text-destructive hover:text-destructive"
                                title="Excluir cliente"
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
                {filteredClientes.map((c) => {
                  const seg = c.carteira?.trim().toUpperCase()
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-lg border border-border bg-card space-y-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-foreground text-base leading-tight">
                            {c.name}
                          </h4>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {formatCNPJ(c.cnpj) || 'CNPJ não informado'}
                          </p>
                        </div>
                        {seg && (
                          <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                            {seg}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>{getCidadeUfDisplay(c)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>Vendedor: {getVendedorDisplay(c)}</span>
                        </div>
                        {c.contato && (
                          <div className="text-xs text-muted-foreground">
                            Contato: <span className="text-foreground">{c.contato}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => handleOpenEdit(c)}
                        >
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                          onClick={() => setDeletingCliente(c)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      )}

      {/* Modal de Criação / Edição */}
      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditingCliente(null)
        }}
        cliente={editingCliente}
        gestaoTecnicaList={gestaoTecnicaList}
        onSuccess={loadData}
      />

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog
        open={!!deletingCliente}
        onOpenChange={(open) => {
          if (!open) setDeletingCliente(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir este cliente? Esta ação não pode ser desfeita.
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
