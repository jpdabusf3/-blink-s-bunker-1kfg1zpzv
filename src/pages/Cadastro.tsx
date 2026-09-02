import { useState, useEffect, useMemo, useRef } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Loader2,
  Plus,
  Trash2,
  Edit,
  Building2,
  Search,
  Upload,
  Filter,
  RotateCcw,
  FileArchive,
  Download,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { getAllFactories, deleteFactoryPB } from '@/services/factories'
import { getScopedFactories } from '@/lib/user-scope'
import { normalizeArray } from '@/lib/utils'
import { FactoryForm } from '@/components/FactoryForm'
import { ImportExcelDialog } from '@/components/ImportExcelDialog'
import { MultiSelect } from '@/components/ui/multi-select'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'
import { exportBatchClientReportsZip, logBatchReportExport } from '@/lib/batchReportExport'
import { generateClientGoogleDocsHtml, dateStamp } from '@/services/client-reports'
import { getReportTemplatePreference } from '@/services/report-template-preferences'
import { REPORT_TEMPLATE_LABEL, type ReportTemplateKey } from '@/lib/reportTemplates'
import { exportClientsToCSV } from '@/lib/csv-export'
import { enrichClientData, type EnrichmentSummary } from '@/services/enrichment-service'
import { FilePlus2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Factory } from '@/types'

const REGION_OPTIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
const SPECIES_OPTIONS = [
  'Ruminantes',
  'Aves',
  'Suinos',
  'Pet',
  'Aqua',
  'Equinos',
  'Outros',
  'Multi espécie',
]
const STATUS_OPTIONS = ['Atendido', 'Não atendido', 'Prospeção']
const STATUS_CONTATO_OPTIONS = [
  'Champion',
  'Stakeholder',
  'Decisor',
  'Influenciador',
  'Gatekeepers',
]
const PROFILE_OPTIONS = [
  'Indústria',
  'Cooperativa',
  'Integradora',
  'Premixeira',
  'Produtores',
  'Distribuidor',
  'Outros',
]
const PRODUCT_LINE_OPTIONS = [
  'Adsorventes',
  'Prebióticos',
  'Minerais Orgânicos',
  'Blends',
  'Ingredientes',
]

export default function Cadastro() {
  const { user } = useAuth()
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingFactory, setEditingFactory] = useState<Factory | undefined>(undefined)

  // Export CSV state
  const [csvExporting, setCsvExporting] = useState(false)

  // Enrichment modal states
  const [confirmEnrichOpen, setConfirmEnrichOpen] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichSummary, setEnrichSummary] = useState<EnrichmentSummary | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  // Batch export state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchExporting, setBatchExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null)
  const reportTemplateRef = useRef<ReportTemplateKey>('executivo')

  useEffect(() => {
    getReportTemplatePreference()
      .then((t) => {
        reportTemplateRef.current = t
      })
      .catch(() => {})
  }, [])

  const handleBatchExport = async () => {
    const selected = filtered.filter((f) => selectedIds.has(f.id))
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um cliente para exportar.')
      return
    }
    const modelo = reportTemplateRef.current
    const solicitante = user?.name || user?.email || ''
    setBatchExporting(true)
    setExportProgress({ done: 0, total: selected.length })
    try {
      const result = await exportBatchClientReportsZip(
        selected.map((f) => ({ id: f.id, name: f.name })),
        {
          modelo,
          solicitante,
          onProgress: (p) => setExportProgress({ done: p.done, total: p.total }),
        },
      )
      // Register activity log (best-effort)
      await logBatchReportExport({
        solicitante,
        solicitanteId: user?.id,
        clienteIds: selected.map((f) => f.id),
        modelo,
        formato: 'pdf',
      })

      const okCount = result.count
      const errCount = result.failures.length
      if (errCount === 0) {
        toast.success(`${okCount} PDFs gerados com sucesso!`)
      } else if (okCount === 0) {
        toast.error('Erro ao gerar PDF. Tente novamente.')
      } else {
        toast.warning(`${okCount} PDFs gerados, ${errCount} com erro (verifique o log).`)
      }
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PDF. Tente novamente.')
    } finally {
      setBatchExporting(false)
      setExportProgress(null)
    }
  }

  const handleBatchGoogleDocsExport = async () => {
    const selected = filtered.filter((f) => selectedIds.has(f.id))
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um cliente para exportar.')
      return
    }
    const modelo = reportTemplateRef.current
    const solicitante = user?.name || user?.email || ''
    setBatchExporting(true)
    setExportProgress({ done: 0, total: selected.length })
    try {
      let opened = 0
      for (let i = 0; i < selected.length; i++) {
        const f = selected[i]
        try {
          const html = await generateClientGoogleDocsHtml(f.id, {
            titulo: `Relatório de Histórico — ${f.name}`,
            modelo,
            solicitante,
          })
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
          const url = URL.createObjectURL(blob)
          const win = window.open(url, '_blank')
          if (!win) {
            // popup blocked → download fallback
            const a = document.createElement('a')
            a.href = url
            a.download = `relatorio-${f.name}-${dateStamp()} — Abrir no Google Docs.html`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
          }
          setTimeout(() => URL.revokeObjectURL(url), 60_000)
          opened++
        } catch (err) {
          console.error('[batch google docs] falha', f.name, err)
        }
        setExportProgress({ done: i + 1, total: selected.length })
      }
      await logBatchReportExport({
        solicitante,
        solicitanteId: user?.id,
        clienteIds: selected.map((f) => f.id),
        modelo,
        formato: 'google-docs',
      })
      if (opened === 0) {
        toast.error('Erro ao preparar Google Docs. Tente novamente.')
      } else {
        toast.success(`Relatório pronto para Google Docs! (${opened}/${selected.length})`)
        setSelectedIds(new Set())
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao preparar Google Docs. Tente novamente.',
      )
    } finally {
      setBatchExporting(false)
      setExportProgress(null)
    }
  }

  // Multi-select filters
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedSpecies, setSelectedSpecies] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedStatusContatos, setSelectedStatusContatos] = useState<string[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [selectedProductLines, setSelectedProductLines] = useState<string[]>([])

  const loadData = async () => {
    try {
      const all = await getAllFactories()
      setFactories(getScopedFactories(all, user))
    } catch {
      setFactories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  useRealtime('factories', () => loadData())

  const clearFilters = () => {
    setSearch('')
    setSelectedRegions([])
    setSelectedSpecies([])
    setSelectedStatuses([])
    setSelectedProfiles([])
    setSelectedProductLines([])
  }

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedRegions.length > 0 ||
    selectedSpecies.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedStatusContatos.length > 0 ||
    selectedProfiles.length > 0 ||
    selectedProductLines.length > 0

  const filtered = useMemo(() => {
    return factories.filter((f) => {
      // Search text match
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchText =
          f.name.toLowerCase().includes(q) ||
          f.city?.toLowerCase().includes(q) ||
          f.gestor_tecnico_name?.toLowerCase().includes(q) ||
          f.vendedor_name?.toLowerCase().includes(q)
        if (!matchText) return false
      }

      // Region multi-match (any selected matches any in factory)
      if (selectedRegions.length > 0) {
        const factoryRegions = normalizeArray(f.region)
        const hasRegion = selectedRegions.some((r) => factoryRegions.includes(r))
        if (!hasRegion) return false
      }

      // Species multi-match
      if (selectedSpecies.length > 0) {
        const factorySpecies = normalizeArray(f.animalSpecies)
        const hasSpecies = selectedSpecies.some((s) => factorySpecies.includes(s))
        if (!hasSpecies) return false
      }

      // Status multi-match
      if (selectedStatuses.length > 0) {
        const factoryStatuses = normalizeArray(f.status)
        const hasStatus = selectedStatuses.some((st) => factoryStatuses.includes(st))
        if (!hasStatus) return false
      }

      // Profile type multi-match
      if (selectedProfiles.length > 0) {
        const factoryProfiles = normalizeArray(f.profile_type)
        const hasProfile = selectedProfiles.some((p) => factoryProfiles.includes(p))
        if (!hasProfile) return false
      }

      // Product line affinity multi-match
      if (selectedProductLines.length > 0) {
        const factoryLines = normalizeArray(f.productLineAffinity)
        const hasLine = selectedProductLines.some((l) => factoryLines.includes(l))
        if (!hasLine) return false
      }

      return true
    })
  }, [
    factories,
    search,
    selectedRegions,
    selectedSpecies,
    selectedStatuses,
    selectedProfiles,
    selectedProductLines,
  ])

  const handleEdit = (f: Factory) => {
    setEditingFactory(f)
    setDialogOpen(true)
  }

  const handleNew = () => {
    setEditingFactory(undefined)
    setDialogOpen(true)
  }

  const { logAction } = useFunnelActivityLog()

  const handleExportCSV = async () => {
    setCsvExporting(true)
    try {
      // Respect current active page filters
      if (filtered.length === 0) {
        toast.info('Nenhum cliente cadastrado para exportar.')
        return
      }

      const { count } = exportClientsToCSV(filtered)
      toast.success(`${count} clientes exportados com sucesso.`)
    } catch (err) {
      console.error('[export csv] erro ao exportar', err)
      toast.error('Erro ao exportar clientes. Tente novamente.')
    } finally {
      setCsvExporting(false)
    }
  }

  const handleOpenEnrichConfirm = () => {
    if (factories.length === 0) {
      toast.info('Nenhum cliente para enriquecer.')
      return
    }
    setConfirmEnrichOpen(true)
  }

  const handleStartEnrichment = async () => {
    setConfirmEnrichOpen(false)
    setEnriching(true)
    try {
      const summary = await enrichClientData({ mode: 'all' })
      setEnriching(false)
      setEnrichSummary(summary)
      setSummaryOpen(true)
      toast.success('Enriquecimento concluido!')
      loadData()
    } catch (err) {
      console.error('[enrichment] erro ao enriquecer', err)
      setEnriching(false)
      toast.error('Erro ao processar enriquecimento. Verifique sua conexao e tente novamente.')
    }
  }

  const handleDelete = async (id: string) => {
    const factory = factories.find((f) => f.id === id)
    if (!confirm('Excluir esta fábrica?')) return
    try {
      await deleteFactoryPB(id)
      toast.success('Fábrica excluída')
      // Funnel activity log: client deleted
      logAction({
        action_type: 'delete',
        entity_type: 'client',
        entity_id: id,
        entity_name: factory?.name || '',
        description: `Excluiu cliente ${factory?.name || id}`,
      })
      loadData()
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cadastro de Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie fábricas, gestores técnicos e vendedores.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={csvExporting}
            onClick={handleExportCSV}
          >
            {csvExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {csvExporting ? 'Exportando...' : 'Exportar CSV'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleOpenEnrichConfirm}>
            <Sparkles className="w-4 h-4" />
            Enriquecer Dados
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> Importar
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/importar-clientes">
              <Upload className="w-4 h-4" /> Importar Clientes (Excel)
            </Link>
          </Button>
          <Button className="gap-2" onClick={handleNew}>
            <Plus className="w-4 h-4" /> Nova Fábrica
          </Button>
        </div>
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Fábricas Cadastradas</CardTitle>
          <CardDescription>{filtered.length} fábrica(s)</CardDescription>
        </CardHeader>
        {selectedIds.size > 0 && (
          <div className="px-6 pb-3 -mb-1 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {selectedIds.size} cliente(s) selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={batchExporting}
                onClick={() => setSelectedIds(new Set())}
              >
                Limpar seleção
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={batchExporting}
                onClick={handleBatchExport}
              >
                {batchExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileArchive className="w-4 h-4" />
                )}
                Exportar PDFs em Lote (ZIP)
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={batchExporting}
                onClick={handleBatchGoogleDocsExport}
              >
                {batchExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FilePlus2 className="w-4 h-4" />
                )}
                Exportar Google Docs em Lote
              </Button>
            </div>
          </div>
        )}
        {exportProgress && (
          <div className="px-6 pb-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Gerando relatórios... {exportProgress.done}/{exportProgress.total} concluídos
              </span>
              <span>Modelo: {REPORT_TEMPLATE_LABEL[reportTemplateRef.current]}</span>
            </div>
            <Progress value={(exportProgress.done / exportProgress.total) * 100} className="h-2" />
          </div>
        )}
        <CardContent className="space-y-4">
          <div className="space-y-3 p-3 bg-muted/20 border rounded-lg">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Filter className="w-4 h-4 text-primary" />
                Filtros Multi-Seleção
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Limpar Filtros
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, cidade, gestor ou vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Região
                </label>
                <MultiSelect
                  options={REGION_OPTIONS}
                  value={selectedRegions}
                  onChange={setSelectedRegions}
                  placeholder="Todas as regiões"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Espécie Animal
                </label>
                <MultiSelect
                  options={SPECIES_OPTIONS}
                  value={selectedSpecies}
                  onChange={setSelectedSpecies}
                  placeholder="Todas as espécies"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Status
                </label>
                <MultiSelect
                  options={STATUS_OPTIONS}
                  value={selectedStatuses}
                  onChange={setSelectedStatuses}
                  placeholder="Todos os status"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Status do Contato
                </label>
                <MultiSelect
                  options={STATUS_CONTATO_OPTIONS}
                  value={selectedStatusContatos}
                  onChange={setSelectedStatusContatos}
                  placeholder="Todos os status"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Perfil / Carteira
                </label>
                <MultiSelect
                  options={PROFILE_OPTIONS}
                  value={selectedProfiles}
                  onChange={setSelectedProfiles}
                  placeholder="Todos os perfis"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Linha de Produtos
                </label>
                <MultiSelect
                  options={PRODUCT_LINE_OPTIONS}
                  value={selectedProductLines}
                  onChange={setSelectedProductLines}
                  placeholder="Todas as linhas"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          filtered.length > 0 && filtered.every((f) => selectedIds.has(f.id))
                        }
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (checked) filtered.forEach((f) => next.add(f.id))
                            else filtered.forEach((f) => next.delete(f.id))
                            return next
                          })
                        }}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Espécie</TableHead>
                    <TableHead>Funil</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status do Contato</TableHead>
                    <TableHead>Gestor Técnico</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground h-16">
                        Nenhuma fábrica encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedIds.has(f.id)}
                            onCheckedChange={(v) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev)
                                if (v) next.add(f.id)
                                else next.delete(f.id)
                                return next
                              })
                            }}
                            aria-label={`Selecionar ${f.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{f.name}</TableCell>
                        <TableCell className="text-sm">
                          {[f.city, f.state].filter(Boolean).join('/') || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {normalizeArray(f.animalSpecies).length === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              normalizeArray(f.animalSpecies).map((sp) => (
                                <Badge key={sp} variant="outline" className="text-xs">
                                  {sp}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{f.funnelStage}</TableCell>
                        <TableCell className="text-sm">
                          {f.contato || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {f.status_contato ? (
                            <Badge variant="outline" className="text-xs">
                              {f.status_contato}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {f.gestor_tecnico_name || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {f.vendedor_name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(f.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditingFactory(undefined)
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFactory ? 'Editar Fábrica' : 'Nova Fábrica'}</DialogTitle>
          </DialogHeader>
          <FactoryForm
            factory={editingFactory}
            onSubmit={() => {
              setDialogOpen(false)
              setEditingFactory(undefined)
              loadData()
            }}
          />
        </DialogContent>
      </Dialog>

      <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} onImported={loadData} />

      {/* Confirmation Dialog: Enriquecer Dados */}
      <Dialog open={confirmEnrichOpen} onOpenChange={setConfirmEnrichOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enriquecimento de Dados</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sera feita a busca de CEP, padronizacao de enderecos e geocodificacao de todos os
            clientes. Isso pode levar alguns minutos. Deseja continuar?
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmEnrichOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStartEnrichment} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Iniciar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 1 (Loading): Processando Enriquecimento */}
      <Dialog open={enriching} onOpenChange={() => {}}>
        <DialogContent
          className="max-w-md text-center py-8 [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Processando enriquecimento de dados...
              </h3>
              <p className="text-sm text-muted-foreground">
                Isso pode levar alguns minutos. Nao feche esta pagina.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2 (Success): Resumo do Enriquecimento Concluido */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enriquecimento Concluido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Total processados:</span>
              <span className="font-semibold text-foreground">
                {enrichSummary?.total_processed ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Total enriquecidos:</span>
              <span className="font-semibold text-foreground">
                {enrichSummary?.total_enriched ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Total geocodificados:</span>
              <span className="font-semibold text-foreground">
                {enrichSummary?.total_geocoded ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Total inconsistentes:</span>
              <span className="font-semibold text-foreground">
                {enrichSummary?.total_inconsistent ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Total falhas:</span>
              <span className="font-semibold text-foreground">
                {enrichSummary?.total_failed ?? 0}
              </span>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setSummaryOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
