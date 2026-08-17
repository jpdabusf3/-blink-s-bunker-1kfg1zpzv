import { useState, useMemo, useEffect, useCallback } from 'react'
import { getAllFactories, updateFactoryPB } from '@/services/factories'
import { getScopedFactories } from '@/lib/user-scope'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getVendedoresGestao,
  getGestoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import { logActivity } from '@/services/activity-logs'
import { exportFunilVendasToExcel } from '@/lib/exportFunilVendas'
import { exportFullDashboardToPDF } from '@/lib/exportFullDashboard'
import { fetchConsolidatedData, type ConsolidatedData } from '@/services/consolidated-dashboard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { ImportFunilDialog } from '@/components/ImportFunilDialog'
import { ClientHistoryDialog } from '@/components/ClientHistoryDialog'
import {
  Upload,
  Filter,
  User,
  ArrowRight,
  Download,
  FileText,
  Save,
  X,
  FileArchive,
  Loader2,
  History,
} from 'lucide-react'
import type { Factory } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import {
  REPORT_TEMPLATES,
  DEFAULT_REPORT_TEMPLATE,
  type ReportTemplateKey,
} from '@/lib/reportTemplates'
import {
  getReportTemplatePreference,
  saveReportTemplatePreference,
} from '@/services/report-template-preferences'
import { exportBatchClientReportsZip, logBatchReportExport } from '@/lib/batchReportExport'
import { useToast } from '@/hooks/use-toast'
import { useFunnelActivityLog } from '@/hooks/use-funnel-activity-log'

const STATUS_COLUMNS = ['Inativo', 'Mensal', 'Ativo'] as const
const SPECIES = [
  'Ruminantes',
  'Aves',
  'Suinos',
  'Pet',
  'Aqua',
  'Equinos',
  'Outros',
  'Multi espécie',
]
const CANAL_VENDAS_OPTIONS = [
  'Direto',
  'Distribuidor',
  'Indústria',
  'Premixera',
  'Cooperativa',
  'Online',
] as const

export default function FunilVendas() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { logAction } = useFunnelActivityLog()
  const [factories, setFactories] = useState<Factory[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [filters, setFilters] = useState({
    vendedor: 'all',
    gestor: 'all',
    canal: 'all',
    especie: 'all',
    status: 'all',
  })
  const [importOpen, setImportOpen] = useState(false)
  const [dashboardData, setDashboardData] = useState<ConsolidatedData | null>(null)
  const [selectedFactoryId, setSelectedFactoryId] = useState<string | null>(null)
  const [historyFactory, setHistoryFactory] = useState<any>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [panelForm, setPanelForm] = useState<{
    proximos_passos: string
    acao: string
    status_funil: string
  }>({
    proximos_passos: '',
    acao: '',
    status_funil: 'Inativo',
  })

  // Persisted "Modelo Visual" report template preference (per user).
  const [reportTemplate, setReportTemplate] = useState<ReportTemplateKey>(DEFAULT_REPORT_TEMPLATE)
  const [templateLoading, setTemplateLoading] = useState(true)

  // Multi-selection of clients (kanban cards) for batch export.
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
  const [batchExporting, setBatchExporting] = useState(false)

  useEffect(() => {
    getReportTemplatePreference()
      .then(setReportTemplate)
      .catch(() => {})
      .finally(() => setTemplateLoading(false))
  }, [])

  const handleTemplateChange = (value: string) => {
    if (value !== 'executivo' && value !== 'tecnico' && value !== 'comercial') return
    setReportTemplate(value)
    saveReportTemplatePreference(value).catch(() => {})
  }

  const loadData = useCallback(async () => {
    try {
      setFactories(await getAllFactories())
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => {
    loadData()
    getVendedoresGestao()
      .then(setVendedores)
      .catch(() => {})
    getGestoresGestao()
      .then(setGestores)
      .catch(() => {})
  }, [loadData])

  useRealtime('factories', () => {
    loadData()
  })

  useEffect(() => {
    fetchConsolidatedData()
      .then(setDashboardData)
      .catch(() => {})
  }, [])
  useRealtime('metas', () => {
    fetchConsolidatedData()
      .then(setDashboardData)
      .catch(() => {})
  })
  useRealtime('historico_vendas', () => {
    fetchConsolidatedData()
      .then(setDashboardData)
      .catch(() => {})
  })

  const scoped = useMemo(() => getScopedFactories(factories, user), [factories, user])

  // Only factories that have placed at least one order.
  const withOrders = useMemo(() => scoped.filter((f) => !!f.ultimo_pedido), [scoped])

  const filtered = useMemo(
    () =>
      withOrders.filter((f) => {
        if (!f.status_funil) return false
        if (filters.vendedor !== 'all' && f.vendedor_id !== filters.vendedor) return false
        if (filters.gestor !== 'all' && f.gestor_tecnico_id !== filters.gestor) return false
        if (filters.canal !== 'all' && f.profile_type !== filters.canal) return false
        if (filters.especie !== 'all' && f.animalSpecies !== filters.especie) return false
        if (filters.status !== 'all' && f.status_funil !== filters.status) return false
        return true
      }),
    [withOrders, filters],
  )

  const selectedFactory = useMemo(
    () => factories.find((f) => f.id === selectedFactoryId) || null,
    [factories, selectedFactoryId],
  )

  const openPanel = (factoryId: string) => {
    const f = factories.find((x) => x.id === factoryId)
    setSelectedFactoryId(factoryId)
    setPanelForm({
      proximos_passos: f?.proximos_passos || '',
      acao: f?.acao || '',
      status_funil: f?.status_funil || 'Inativo',
    })
  }

  const closePanel = () => setSelectedFactoryId(null)

  const handleStatusChange = async (factoryId: string, newStatus: string, oldStatus: string) => {
    if (newStatus === oldStatus) return
    const factory = factories.find((f) => f.id === factoryId)
    setFactories((prev) =>
      prev.map((f) =>
        f.id === factoryId ? { ...f, status_funil: newStatus as Factory['status_funil'] } : f,
      ),
    )
    try {
      await updateFactoryPB(factoryId, { status_funil: newStatus } as any)
      await logActivity(
        `Status Funil: ${oldStatus} → ${newStatus}`,
        `Cliente: ${factory?.name || ''}`,
        factoryId,
        'factories',
        undefined,
        {
          tipo: 'status',
          status_anterior: oldStatus,
          status_novo: newStatus,
          origem: 'funil_vendas',
        },
      )
      // Funnel activity log: deal stage/status change
      logAction({
        action_type: 'status_change',
        entity_type: 'deal',
        entity_id: factoryId,
        entity_name: factory?.name || '',
        old_value: oldStatus,
        new_value: newStatus,
        description: `Moveu negocio ${factory?.name || ''} de ${oldStatus} para ${newStatus}`,
      })
    } catch {
      setFactories((prev) =>
        prev.map((f) =>
          f.id === factoryId ? { ...f, status_funil: oldStatus as Factory['status_funil'] } : f,
        ),
      )
    }
  }

  const handlePanelSave = async () => {
    if (!selectedFactory) return
    const oldStatus = selectedFactory.status_funil || ''
    try {
      await updateFactoryPB(selectedFactory.id, {
        status_funil: panelForm.status_funil,
        proximos_passos: panelForm.proximos_passos,
        acao: panelForm.acao,
      } as any)
      setFactories((prev) =>
        prev.map((f) =>
          f.id === selectedFactory.id
            ? {
                ...f,
                status_funil: panelForm.status_funil as Factory['status_funil'],
                proximos_passos: panelForm.proximos_passos,
                acao: panelForm.acao,
              }
            : f,
        ),
      )
      await logActivity(
        `Painel Funil atualizado`,
        `Cliente: ${selectedFactory.name} • Status: ${panelForm.status_funil} • Próximos passos: ${panelForm.proximos_passos} • Ação: ${panelForm.acao}`,
        selectedFactory.id,
        'factories',
      )
      if (panelForm.status_funil !== oldStatus) {
        await logActivity(
          `Status Funil: ${oldStatus} → ${panelForm.status_funil}`,
          `Cliente: ${selectedFactory.name}`,
          selectedFactory.id,
          'factories',
        )
        logAction({
          action_type: 'move',
          entity_type: 'deal',
          entity_id: selectedFactory.id,
          entity_name: selectedFactory.name,
          old_value: oldStatus,
          new_value: panelForm.status_funil,
          description: `Moveu negocio ${selectedFactory.name} de ${oldStatus} para ${panelForm.status_funil}`,
        })
      }
      // Funnel activity log: deal updated
      logAction({
        action_type: 'update',
        entity_type: 'deal',
        entity_id: selectedFactory.id,
        entity_name: selectedFactory.name,
        description: `Atualizou negocio ${selectedFactory.name}`,
      })
      closePanel()
    } catch {
      /* noop */
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Gestão de clientes por status do funil comercial (apenas com pedidos).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Modelo Visual (Word)
            </label>
            <Select
              value={reportTemplate}
              onValueChange={handleTemplateChange}
              disabled={templateLoading}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Modelo..." />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TEMPLATES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportFunilVendasToExcel(filtered)}
            className="gap-2 h-9"
          >
            <Download className="w-4 h-4" /> Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportFullDashboardToPDF(filtered, dashboardData, filters)}
            className="gap-2 h-9"
          >
            <FileText className="w-4 h-4" /> PDF Dashboard
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 h-9"
            disabled={selectedClientIds.size === 0 || batchExporting}
            onClick={async () => {
              const clients = filtered.filter((f) => selectedClientIds.has(f.id))
              if (clients.length === 0) return
              setBatchExporting(true)
              try {
                const solicitante = user?.name || user?.email || ''
                await exportBatchClientReportsZip(
                  clients.map((f) => ({ id: f.id, name: f.name })),
                  { modelo: reportTemplate, solicitante },
                )
                await logBatchReportExport({
                  solicitante,
                  solicitanteId: user?.id,
                  clienteIds: clients.map((f) => f.id),
                  modelo: reportTemplate,
                })
                toast({
                  title: 'Relatórios em lote gerados',
                  description: `${clients.length} relatório(s) .docx empacotados em ZIP (modelo ${reportTemplate}).`,
                })
                setSelectedClientIds(new Set())
              } catch (err) {
                toast({
                  title: 'Erro na exportação em lote',
                  description: err instanceof Error ? err.message : 'Não foi possível gerar o ZIP.',
                  variant: 'destructive',
                })
              } finally {
                setBatchExporting(false)
              }
            }}
          >
            {batchExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileArchive className="w-4 h-4" />
            )}
            Gerar em Lote ({selectedClientIds.size})
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)} className="gap-2 h-9">
            <Upload className="w-4 h-4" /> Importar Funil (Excel)
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select
          value={filters.gestor}
          onValueChange={(v) => setFilters((p) => ({ ...p, gestor: v }))}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Gestor Técnico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Gestores</SelectItem>
            {gestores.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.vendedor}
          onValueChange={(v) => setFilters((p) => ({ ...p, vendedor: v }))}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Vendedores</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.canal}
          onValueChange={(v) => setFilters((p) => ({ ...p, canal: v }))}
        >
          <SelectTrigger className="w-[170px] h-9">
            <SelectValue placeholder="Canal de Vendas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Canais</SelectItem>
            {CANAL_VENDAS_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.especie}
          onValueChange={(v) => setFilters((p) => ({ ...p, especie: v }))}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Espécie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Espécies</SelectItem>
            {SPECIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((p) => ({ ...p, status: v }))}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {STATUS_COLUMNS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
        <div className="flex gap-4 min-w-max h-full items-stretch">
          {STATUS_COLUMNS.map((status) => {
            const items = filtered.filter((f) => f.status_funil === status)
            const totalValue = items.reduce((s, f) => s + (f.valor_medio || 0), 0)

            return (
              <div
                key={status}
                className="w-80 bg-muted/40 border rounded-xl flex flex-col max-h-full"
              >
                <div className="p-3 border-b bg-card/50 rounded-t-xl sticky top-0 z-10">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-sm text-foreground">{status}</h3>
                    <Badge variant="secondary" className="font-mono">
                      {items.length}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {formatCurrency(totalValue)}
                  </div>
                </div>

                <div className="p-2 flex-1 overflow-y-auto space-y-3">
                  {items.map((f) => (
                    <Card
                      key={f.id}
                      className="p-3 shadow-subtle hover:shadow-md transition-all cursor-pointer"
                      onClick={() => openPanel(f.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedClientIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(f.id)) next.delete(f.id)
                              else next.add(f.id)
                              return next
                            })
                          }}
                          className="pt-0.5"
                        >
                          <Checkbox
                            checked={selectedClientIds.has(f.id)}
                            aria-label={`Selecionar ${f.name}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm leading-tight line-clamp-2">
                            {f.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[f.city, f.animalSpecies].filter(Boolean).join(' • ')}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs">
                        <span className="text-muted-foreground">Valor Médio:</span>
                        <span className="text-primary font-bold">
                          {formatCurrency(f.valor_medio || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className="text-muted-foreground">Valor Atual:</span>
                        <span className="font-semibold">{formatCurrency(f.valor_atual || 0)}</span>
                      </div>

                      {f.proximos_passos && (
                        <div className="mt-2 text-[10px] bg-muted/60 p-1.5 rounded border">
                          <div className="font-semibold text-primary flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" /> Próximos Passos:
                          </div>
                          <p className="line-clamp-2 italic text-muted-foreground">
                            {f.proximos_passos}
                          </p>
                        </div>
                      )}

                      {f.acao && (
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          <span className="font-semibold">Ação:</span> {f.acao}
                        </div>
                      )}

                      {f.vendedor_name && (
                        <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3 text-primary" />
                          <span className="truncate">{f.vendedor_name}</span>
                        </div>
                      )}

                      <div className="flex gap-1 mt-2 pt-2 border-t">
                        {STATUS_COLUMNS.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={f.status_funil === s ? 'default' : 'outline'}
                            className="h-6 text-[10px] flex-1 px-1"
                            disabled={f.status_funil === s}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStatusChange(f.id, s, f.status_funil || '')
                            }}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center p-4 text-xs text-muted-foreground border border-dashed rounded-lg">
                      Sem clientes
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Side panel for editing a factory's funil details */}
      <Sheet open={!!selectedFactoryId} onOpenChange={(v) => !v && closePanel()}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedFactory?.name || 'Cliente'}</SheetTitle>
            <SheetDescription>
              Edite as informações do funil de vendas deste cliente.
            </SheetDescription>
          </SheetHeader>

          {selectedFactory && (
            <div className="space-y-4 px-1 pb-2">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Situação atual:</span>
                  <Badge variant="secondary">{selectedFactory.status_funil || '—'}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último pedido:</span>
                  <span className="font-medium">
                    {selectedFactory.ultimo_pedido
                      ? formatDateTime(selectedFactory.ultimo_pedido)
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Atualizado:</span>
                  <span className="font-medium">
                    {selectedFactory.updated
                      ? formatDateTime(selectedFactory.updated)
                      : selectedFactory.created
                        ? formatDateTime(selectedFactory.created)
                        : '—'}
                  </span>
                </div>
                {selectedFactory.vendedor_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vendedor:</span>
                    <span className="font-medium">{selectedFactory.vendedor_name}</span>
                  </div>
                )}
                {selectedFactory.gestor_tecnico_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gestor técnico:</span>
                    <span className="font-medium">{selectedFactory.gestor_tecnico_name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Categoria do Funil</Label>
                <Select
                  value={panelForm.status_funil}
                  onValueChange={(v) => setPanelForm((p) => ({ ...p, status_funil: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_COLUMNS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Próximo Passo</Label>
                <Textarea
                  rows={3}
                  value={panelForm.proximos_passos}
                  onChange={(e) => setPanelForm((p) => ({ ...p, proximos_passos: e.target.value }))}
                  placeholder="Descreva o próximo passo..."
                />
              </div>

              <div className="space-y-2">
                <Label>Ação</Label>
                <Textarea
                  rows={3}
                  value={panelForm.acao}
                  onChange={(e) => setPanelForm((p) => ({ ...p, acao: e.target.value }))}
                  placeholder="Descreva a ação..."
                />
              </div>
            </div>
          )}

          <SheetFooter className="gap-2 flex-col">
            <Button
              variant="secondary"
              className="gap-2 w-full"
              onClick={() => {
                if (selectedFactory) {
                  setHistoryFactory(selectedFactory)
                  setHistoryOpen(true)
                }
              }}
            >
              <History className="w-4 h-4" /> Ver Histórico de Ações
            </Button>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={closePanel} className="gap-2 flex-1">
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button onClick={handlePanelSave} className="gap-2 flex-1">
                <Save className="w-4 h-4" /> Salvar
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ImportFunilDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => loadData()}
      />

      <ClientHistoryDialog
        factory={historyFactory}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        origin="funil_vendas"
      />
    </div>
  )
}
