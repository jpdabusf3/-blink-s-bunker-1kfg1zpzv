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
import {
  type FunilVendasStatus,
  deriveFunilVendasStatus,
  STATUS_TO_FUNNEL_STAGE,
  FUNNEL_STAGES_PERMITIDOS,
} from '@/lib/funnel-status'
import { factoryMatchesVendedor } from '@/lib/vendedorFilterHelper'
import { CANONICAL_SPECIES } from '@/components/FactoryForm'

export type { FunilVendasStatus }
export { deriveFunilVendasStatus }

const STATUS_COLUMNS: readonly FunilVendasStatus[] = [
  'Ativo',
  'Inativo',
  'Negociações Encerradas',
] as const

// 5 espécies canônicas + legadas existentes para compatibilidade de filtro
const SPECIES = [...CANONICAL_SPECIES, 'Aqua', 'Equinos', 'Outros', 'Multi espécie']
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
    status_funil: FunilVendasStatus
  }>({
    proximos_passos: '',
    acao: '',
    status_funil: 'Ativo',
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

  // Clientes derivados automaticamente pelo funnelStage (apenas Fechamento, Pós-venda e Perda)
  const funilVendasClients = useMemo(() => {
    return scoped
      .filter((f) => FUNNEL_STAGES_PERMITIDOS.has(f.funnelStage))
      .map((f) => {
        const derivedStatus = deriveFunilVendasStatus(f.funnelStage, f.ultimo_pedido) || 'Ativo'
        return {
          ...f,
          status_funil: derivedStatus as any,
        }
      })
  }, [scoped])

  const filtered = useMemo(
    () =>
      funilVendasClients.filter((f) => {
        const status = f.status_funil as FunilVendasStatus
        if (filters.vendedor !== 'all' && !factoryMatchesVendedor(f, filters.vendedor)) return false
        if (filters.gestor !== 'all' && f.gestor_tecnico_id !== filters.gestor) return false
        if (filters.canal !== 'all' && f.profile_type !== filters.canal) return false
        if (filters.especie !== 'all') {
          const factorySpecies = Array.isArray(f.animalSpecies)
            ? f.animalSpecies
            : [f.animalSpecies].filter(Boolean)
          const matches = factorySpecies.some((s) => {
            if (s === filters.especie) return true
            // Compatibilidade se o filtro for Multiespécies ou Multi espécie
            if (
              (filters.especie === 'Multiespécies' && s === 'Multi espécie') ||
              (filters.especie === 'Multi espécie' && s === 'Multiespécies')
            ) {
              return true
            }
            return false
          })
          if (!matches) return false
        }
        if (filters.status !== 'all' && status !== filters.status) return false
        return true
      }),
    [funilVendasClients, filters],
  )

  const selectedFactory = useMemo(
    () => factories.find((f) => f.id === selectedFactoryId) || null,
    [factories, selectedFactoryId],
  )

  const openPanel = (factoryId: string) => {
    const f = factories.find((x) => x.id === factoryId)
    setSelectedFactoryId(factoryId)
    const currentStatus: FunilVendasStatus =
      deriveFunilVendasStatus(f?.funnelStage, f?.ultimo_pedido) ||
      (f?.status_funil as FunilVendasStatus) ||
      'Ativo'
    setPanelForm({
      proximos_passos: f?.proximos_passos || '',
      acao: f?.acao || '',
      status_funil: currentStatus,
    })
  }

  const closePanel = () => setSelectedFactoryId(null)

  const handleStatusChange = async (
    factoryId: string,
    newStatus: FunilVendasStatus,
    oldStatus: FunilVendasStatus,
  ) => {
    if (newStatus === oldStatus) return
    const factory = factories.find((f) => f.id === factoryId)
    const oldStage = factory?.funnelStage || STATUS_TO_FUNNEL_STAGE[oldStatus]
    const newStage = STATUS_TO_FUNNEL_STAGE[newStatus]

    // Atualização otimista
    setFactories((prev) =>
      prev.map((f) =>
        f.id === factoryId
          ? {
              ...f,
              funnelStage: newStage,
              status_funil: newStatus as any,
            }
          : f,
      ),
    )
    try {
      await updateFactoryPB(factoryId, {
        funnelStage: newStage,
        status_funil: newStatus,
      } as any)
      await logActivity(
        `Status Funil de Vendas: ${oldStatus} → ${newStatus} (${newStage})`,
        `Cliente: ${factory?.name || ''}`,
        factoryId,
        'factories',
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
        description: `Moveu negócio ${factory?.name || ''} de ${oldStatus} (${oldStage}) para ${newStatus} (${newStage})`,
      })
    } catch {
      // Reversão em caso de erro
      setFactories((prev) =>
        prev.map((f) =>
          f.id === factoryId
            ? {
                ...f,
                funnelStage: oldStage,
                status_funil: oldStatus as any,
              }
            : f,
        ),
      )
      toast({
        title: 'Erro ao mover cliente',
        description: 'Não foi possível atualizar o status no servidor.',
        variant: 'destructive',
      })
    }
  }

  const handlePanelSave = async () => {
    if (!selectedFactory) return
    const currentDerivedStatus: FunilVendasStatus =
      deriveFunilVendasStatus(selectedFactory.funnelStage, selectedFactory.ultimo_pedido) || 'Ativo'
    const oldStatus = currentDerivedStatus
    const oldStage = selectedFactory.funnelStage
    const newStatus = panelForm.status_funil
    const newStage = STATUS_TO_FUNNEL_STAGE[newStatus]
    const stageChanged = newStatus !== oldStatus

    const prevFactory = { ...selectedFactory }

    // Atualização otimista
    setFactories((prev) =>
      prev.map((f) =>
        f.id === selectedFactory.id
          ? {
              ...f,
              funnelStage: newStage,
              status_funil: newStatus as any,
              proximos_passos: panelForm.proximos_passos,
              acao: panelForm.acao,
            }
          : f,
      ),
    )

    try {
      await updateFactoryPB(selectedFactory.id, {
        funnelStage: newStage,
        status_funil: newStatus,
        proximos_passos: panelForm.proximos_passos,
        acao: panelForm.acao,
      } as any)

      await logActivity(
        `Painel Funil atualizado`,
        `Cliente: ${selectedFactory.name} • Status: ${newStatus} (${newStage}) • Próximos passos: ${panelForm.proximos_passos} • Ação: ${panelForm.acao}`,
        selectedFactory.id,
        'factories',
      )
      if (stageChanged) {
        await logActivity(
          `Status Funil: ${oldStatus} → ${newStatus} (${newStage})`,
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
          new_value: newStatus,
          description: `Moveu negócio ${selectedFactory.name} de ${oldStatus} para ${newStatus} (${newStage})`,
        })
      }
      // Funnel activity log: deal updated
      logAction({
        action_type: 'update',
        entity_type: 'deal',
        entity_id: selectedFactory.id,
        entity_name: selectedFactory.name,
        description: `Atualizou negócio ${selectedFactory.name}`,
      })
      closePanel()
    } catch {
      // Reversão
      setFactories((prev) => prev.map((f) => (f.id === selectedFactory.id ? prevFactory : f)))
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações no servidor.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm">
            Gestão de clientes por status do funil comercial (alimentado pelo Funil).
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
                  formato: 'pdf',
                })
                toast({
                  title: 'PDFs gerados com sucesso!',
                  description: `${clients.length} relatório(s) PDF empacotados em ZIP (modelo ${reportTemplate}).`,
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
                            className="h-6 text-[9px] flex-1 px-1 truncate"
                            disabled={f.status_funil === s}
                            title={s}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStatusChange(
                                f.id,
                                s,
                                (f.status_funil as FunilVendasStatus) || 'Ativo',
                              )
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
                  <Badge variant="secondary">
                    {deriveFunilVendasStatus(
                      selectedFactory.funnelStage,
                      selectedFactory.ultimo_pedido,
                    ) ||
                      selectedFactory.status_funil ||
                      '—'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estágio do Funil:</span>
                  <span className="font-medium">{selectedFactory.funnelStage || '—'}</span>
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
                  onValueChange={(v) =>
                    setPanelForm((p) => ({ ...p, status_funil: v as FunilVendasStatus }))
                  }
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
