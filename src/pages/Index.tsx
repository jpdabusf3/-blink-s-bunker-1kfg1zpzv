import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useAuth } from '@/hooks/use-auth'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCompactCurrency, normalizeArray } from '@/lib/utils'
import { deriveFunilVendasStatus } from '@/lib/funnel-status'
import { matchesProfileCategory } from '@/constants/clientCategories'
import { Download, GripVertical, Filter, Globe, MapPin, Compass, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  generateDashboardSalesCSV,
  downloadDashboardSalesCSV,
  formatDateDDMMYYYY,
  formatMonthDelivery,
  type DashboardSalesExportRow,
} from '@/lib/dashboard-csv-export'
import { ScoreEvolutionCard } from '@/components/dashboard/ScoreEvolutionCard'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { FactoryListCard } from '@/components/dashboard/FactoryListCard'
import { TargetsCard } from '@/components/dashboard/TargetsCard'
import { GlobalRankingCard } from '@/components/dashboard/GlobalRankingCard'
import { RevenueVsTargetCard } from '@/components/dashboard/RevenueVsTargetCard'
import { DailySalesLogCard } from '@/components/dashboard/DailySalesLogCard'
import { LocalFactoryStatusCard } from '@/components/dashboard/LocalFactoryStatusCard'
import { FactoriesByStateCard } from '@/components/dashboard/FactoriesByStateCard'
import { FactoriesBySpeciesCard } from '@/components/dashboard/FactoriesBySpeciesCard'
import { HistoricalComparisonCard } from '@/components/dashboard/HistoricalComparisonCard'
import { TimelineSummaryCard } from '@/components/dashboard/TimelineSummaryCard'
import { GeographicOverview } from '@/components/dashboard/GeographicOverview'
import { ExecutiveDashboardCard } from '@/components/dashboard/ExecutiveDashboardCard'
import { ConsolidatedDashboard } from '@/components/dashboard/ConsolidatedDashboard'
import { GestorTecnicoComparisonCard } from '@/components/dashboard/GestorTecnicoComparisonCard'
import { DashboardCustomizer } from '@/components/dashboard/DashboardCustomizer'
import { useDashboardPreferences } from '@/hooks/use-dashboard-preferences'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { UserFilter } from '@/components/UserFilter'
import { factoryMatchesVendedor, type UnifiedVendedorOption } from '@/lib/vendedorFilterHelper'
import { testIntegration } from '@/services/integration-test'
import { toast } from 'sonner'
import { SyncErrorBanner } from '@/components/SyncErrorBanner'

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)

const DEFAULT_BLOCKS = [
  'metrics',
  'executive',
  'consolidated',
  'targets',
  'role-widgets',
  'maps',
  'distribution',
  'charts',
  'historical',
  'list',
  'gestor-comparison',
]

function DraggableBlock({
  id,
  index,
  moveBlock,
  children,
}: {
  id: string
  index: number
  moveBlock: (f: number, t: number) => void
  children: React.ReactNode
}) {
  const [isDraggable, setIsDraggable] = useState(false)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', index.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(sourceIndex) && sourceIndex !== index) {
      moveBlock(sourceIndex, index)
    }
    setIsDraggable(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="relative group transition-all"
    >
      <div
        className="absolute -top-3 -left-3 p-1.5 bg-card border rounded-md shadow-sm cursor-grab opacity-0 group-hover:opacity-100 z-10 hidden sm:block hover:bg-accent hover:text-accent-foreground transition-colors"
        onMouseEnter={() => setIsDraggable(true)}
        onMouseLeave={() => setIsDraggable(false)}
        title="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      {children}
    </div>
  )
}

export default function Index() {
  const { tasks, orders } = useAppContext()
  const factories = useScopedFactories()
  const {
    isLoading: isSyncLoading,
    isError: isSyncError,
    refetch: refetchSync,
  } = useRealtimeData<{ loaded: boolean }>({
    entities: [
      'factories',
      'metas',
      'historico_vendas',
      'pedidos_carteira',
      'faturamento',
      'orders',
      'pedidos',
    ],
    fetcher: async () => ({ loaded: true }),
    initialData: { loaded: true },
  })
  const { user } = useAuth()
  const userRegion = user?.geographicArea || ''

  const [regionFilter, setRegionFilter] = useState('Todas as Regiões')
  const [viewMode, setViewMode] = useState<'global' | 'regional' | 'geographic'>('global')
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')
  const [vendedorOptions, setVendedorOptions] = useState<UnifiedVendedorOption[]>([])
  const [stateFilter, setStateFilter] = useState('all')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [integrationLoading, setIntegrationLoading] = useState(false)
  const [isExportingCSV, setIsExportingCSV] = useState(false)
  const [clientSearchFilter, setClientSearchFilter] = useState('')

  const {
    blocks,
    setBlocks,
    toggleBlock,
    reset,
    periodView,
    setPeriodView,
    lastAutomationPeriod,
    refreshPreferences,
  } = useDashboardPreferences()

  useRealtimeData('dashboard_preferences', refreshPreferences)

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newBlocks = [...blocks]
      const [moved] = newBlocks.splice(fromIndex, 1)
      newBlocks.splice(toIndex, 0, moved)
      setBlocks(newBlocks)
    },
    [blocks, setBlocks],
  )

  // Visão global como padrão para todos os usuários (sem restrição automática à região do usuário)
  const effectiveRegionFilter = useMemo(
    () => (viewMode === 'regional' ? regionFilter : 'Todas as Regiões'),
    [viewMode, regionFilter],
  )

  const filteredFactories = useMemo(() => {
    return factories.filter((f) => {
      const regionMatch =
        effectiveRegionFilter === 'Todas as Regiões' ||
        normalizeArray(f.region).includes(effectiveRegionFilter) ||
        f.stateRegion === effectiveRegionFilter
      const ownerMatch =
        salesOwnerFilter === 'all' || factoryMatchesVendedor(f, salesOwnerFilter, vendedorOptions)
      const stateMatch = stateFilter === 'all' || f.state === stateFilter
      const speciesMatch =
        speciesFilter === 'all' ||
        normalizeArray(f.animalSpecies).includes(speciesFilter) ||
        (f.sector && f.sector.toLowerCase().includes(speciesFilter.toLowerCase()))
      const clientMatch =
        !clientSearchFilter || f.name.toLowerCase().includes(clientSearchFilter.toLowerCase())
      return regionMatch && ownerMatch && stateMatch && speciesMatch && clientMatch
    })
  }, [
    factories,
    effectiveRegionFilter,
    salesOwnerFilter,
    vendedorOptions,
    stateFilter,
    speciesFilter,
    clientSearchFilter,
  ])

  const fabricasCount = useMemo(() => {
    return filteredFactories.filter((f) => matchesProfileCategory(f.profile_type, 'Indústria'))
      .length
  }, [filteredFactories])

  const outrosClientesCount = useMemo(() => {
    return filteredFactories.length - fabricasCount
  }, [filteredFactories, fabricasCount])

  const metrics = useMemo(
    () => ({
      revenue: filteredFactories.reduce((s, f) => s + f.potentialValue, 0),
      weighted: filteredFactories.reduce(
        (s, f) => s + f.potentialValue * (f.winProbability / 100),
        0,
      ),
      active: filteredFactories.filter(
        (f) => deriveFunilVendasStatus(f.funnelStage, f.ultimo_pedido) === 'Ativo',
      ).length,
      prospect: filteredFactories.filter((f) => normalizeArray(f.status).includes('Prospeção'))
        .length,
    }),
    [filteredFactories],
  )

  const handleExportPDF = () => {
    const originalTitle = document.title
    const safeRegion = (effectiveRegionFilter || 'Global').replace(/\s+/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    document.title = `Relatorio_${safeRegion}_${dateStr}`
    window.print()
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }

  const handleWhatsAppShare = () => {
    let text = '*Resumo Operacional - Inteligência Comercial Blink*\n\n'

    const recentFactories = [...filteredFactories]
      .sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime())
      .slice(0, 5)

    text += '*Últimas Visitas/Interações:*\n'
    recentFactories.forEach((f) => {
      const date = new Date(f.lastInteraction).toLocaleDateString('pt-BR')
      text += `- ${f.name} (${date}): ${f.status} - ${f.funnelStage}\n`
    })

    const scopedFactoryIds = new Set(filteredFactories.map((f) => f.id))
    const pendingTasks = tasks
      .filter((t) => !t.completed && scopedFactoryIds.has(t.factoryId))
      .sort((a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime())

    text += '\n*Pendências:*\n'
    if (pendingTasks.length > 0) {
      pendingTasks.forEach((t) => {
        const date = t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : 'Sem data'
        const factory = filteredFactories.find((f) => f.id === t.factoryId)
        const factoryName = factory ? ` (${factory.name})` : ''
        text += `- [ ] ${t.description}${factoryName} (Venc: ${date})\n`
      })
    } else {
      text += 'Nenhuma pendência.\n'
    }

    const encodedText = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer')
  }

  const handleTestIntegration = async () => {
    setIntegrationLoading(true)
    try {
      const result = await testIntegration()
      const collectionsList = Object.entries(result.collections || {})
        .map(([k, v]) => `${k}: ${v ? 'OK' : 'AUSENTE'}`)
        .join(' | ')
      toast.success(`Integração OK — ${result.banco}`, { description: collectionsList })
    } catch (err) {
      toast.error('Erro na integração', {
        description: err instanceof Error ? err.message : 'falha na conexão',
      })
    } finally {
      setIntegrationLoading(false)
    }
  }

  // Prepara dataset filtrado em memória para exportação CSV sem nova requisição de rede
  const exportableRows = useMemo<DashboardSalesExportRow[]>(() => {
    const factoryMap = new Map<string, (typeof filteredFactories)[0]>()
    filteredFactories.forEach((f) => factoryMap.set(f.id, f))

    const rows: DashboardSalesExportRow[] = []

    // 1. Pedidos associados às fábricas filtradas
    if (orders && orders.length > 0) {
      orders.forEach((o) => {
        const fac = factoryMap.get(o.factoryId)
        if (fac) {
          const clientName = fac.name || o.client_name || 'Cliente'
          const city = fac.city || ''
          const state = fac.state || ''
          const sector =
            fac.sector ||
            (Array.isArray(fac.animalSpecies) ? fac.animalSpecies.join(', ') : fac.animalSpecies) ||
            ''
          const productFamily = (o.line || fac.productLineAffinity || o.product || '') as string
          const rawDate = o.orderDate || o.order_date || o.created || ''
          const dataPedido = formatDateDDMMYYYY(rawDate)
          const mesEntrega = formatMonthDelivery(rawDate)
          const quantidade = o.quantity || 1
          const calculatedVal =
            o.totalValue ??
            o.total_value ??
            (o.quantity && o.unitValue ? o.quantity * o.unitValue : 0)
          const valorTotal = Number(calculatedVal)

          rows.push({
            cliente: clientName,
            cidade: city,
            estado: state,
            segmento: sector,
            familiaProduto: productFamily,
            dataPedido,
            mesEntrega,
            quantidade,
            valorTotal,
          })
        }
      })
    }

    // 2. Se nenhuma ordem individual foi associada mas há fábricas filtradas na carteira,
    // exportar os registros da carteira filtrada exibidos no Dashboard
    if (rows.length === 0 && filteredFactories.length > 0) {
      filteredFactories.forEach((fac) => {
        const clientName = fac.name || 'Cliente'
        const city = fac.city || ''
        const state = fac.state || ''
        const sector =
          fac.sector ||
          (Array.isArray(fac.animalSpecies) ? fac.animalSpecies.join(', ') : fac.animalSpecies) ||
          ''
        const productFamily = Array.isArray(fac.productLineAffinity)
          ? fac.productLineAffinity.join(', ')
          : fac.productLineAffinity || ''
        const rawDate = fac.ultimo_pedido || fac.lastInteraction || fac.created || ''
        const dataPedido = formatDateDDMMYYYY(rawDate)
        const mesEntrega = formatMonthDelivery(rawDate)
        const quantidade = fac.capacity || 1
        const valorTotal = Number(fac.potentialValue || fac.valor_atual || fac.valor_medio || 0)

        rows.push({
          cliente: clientName,
          cidade: city,
          estado: state,
          segmento: sector,
          familiaProduto: productFamily,
          dataPedido,
          mesEntrega,
          quantidade,
          valorTotal,
        })
      })
    }

    return rows
  }, [filteredFactories, orders])

  const handleExportCSV = async () => {
    if (exportableRows.length === 0) {
      toast.error('Nenhum dado para exportar com os filtros atuais')
      return
    }

    setIsExportingCSV(true)
    try {
      // Pequeno timeout para permitir que o spinner renderize de forma fluida
      await new Promise((r) => setTimeout(r, 80))

      const todayStr = new Date().toISOString().split('T')[0]
      const filename = `dashboard-vendas-${todayStr}.csv`
      const csvString = generateDashboardSalesCSV(exportableRows)
      downloadDashboardSalesCSV(filename, csvString)

      toast.success('Exportação concluída', {
        description: `${exportableRows.length} registros exportados com sucesso.`,
      })
    } catch (err) {
      console.error('[Index] Falha na exportação CSV:', err)
      toast.error('Não foi possível exportar. Tente novamente.', {
        action: {
          label: 'Tentar novamente',
          onClick: () => handleExportCSV(),
        },
      })
    } finally {
      setIsExportingCSV(false)
    }
  }

  const renderBlock = (id: string) => {
    switch (id) {
      case 'executive':
        return <ExecutiveDashboardCard />
      case 'consolidated':
        return <ConsolidatedDashboard periodView={periodView} onPeriodViewChange={setPeriodView} />
      case 'gestor-comparison':
        return <GestorTecnicoComparisonCard />
      case 'metrics':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5 print:gap-4 print:mb-8">
            <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] text-center flex flex-col justify-center items-center p-4 hover-lift print:border-none print:shadow-none">
              <h3 className="uppercase tracking-[0.08em] font-semibold text-[12px] text-[#A1A1AA] mb-1 leading-tight">
                Fábricas Mapeadas
              </h3>
              <div className="text-[28px] font-bold tabular-nums text-white tracking-tight">
                {fabricasCount}
              </div>
            </Card>
            <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] text-center flex flex-col justify-center items-center p-4 hover-lift print:border-none print:shadow-none">
              <h3 className="uppercase tracking-[0.08em] font-semibold text-[12px] text-[#A1A1AA] mb-1 leading-tight">
                Outros Clientes
              </h3>
              <div className="text-[28px] font-bold tabular-nums text-white tracking-tight">
                {outrosClientesCount}
              </div>
            </Card>
            <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] text-center flex flex-col justify-center items-center p-4 hover-lift print:border-none print:shadow-none">
              <h3 className="uppercase tracking-[0.08em] font-semibold text-[12px] text-[#A1A1AA] mb-1 leading-tight">
                Ativas / Prospecção
              </h3>
              <div className="text-[28px] font-bold tabular-nums text-white tracking-tight">
                <span className="text-[#E5B64E]">{metrics.active}</span>
                <span className="text-[#A1A1AA] text-sm font-normal"> / </span>
                <span className="text-[#E85635]">{metrics.prospect}</span>
              </div>
            </Card>
            <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] text-center flex flex-col justify-center items-center p-4 hover-lift print:border-none print:shadow-none">
              <h3 className="uppercase tracking-[0.08em] font-semibold text-[12px] text-[#A1A1AA] mb-1 leading-tight">
                Receita Potencial
              </h3>
              <div className="text-[28px] font-bold tabular-nums text-[#E5B64E] print:text-xl tracking-tight">
                {formatCompactCurrency(metrics.revenue)}
              </div>
            </Card>
            <Card className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] text-center flex flex-col justify-center items-center p-4 hover-lift print:border-none print:shadow-none">
              <h3 className="uppercase tracking-[0.08em] font-semibold text-[12px] text-[#A1A1AA] mb-1 leading-tight">
                Forecast Ponderado
              </h3>
              <div className="text-[28px] font-bold tabular-nums text-[#E5B64E] print:text-xl tracking-tight">
                {formatCompactCurrency(metrics.weighted)}
              </div>
            </Card>
          </div>
        )
      case 'targets':
        return <TargetsCard regionFilter={effectiveRegionFilter} />
      case 'role-widgets': {
        if (viewMode === 'global') {
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlobalRankingCard />
              <RevenueVsTargetCard />
            </div>
          )
        }
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailySalesLogCard regionFilter={effectiveRegionFilter} />
            <LocalFactoryStatusCard regionFilter={effectiveRegionFilter} />
          </div>
        )
      }
      case 'maps':
        return (
          <div className="grid grid-cols-1 gap-6">
            <ScoreEvolutionCard regionFilter={effectiveRegionFilter} />
          </div>
        )
      case 'distribution':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FactoriesByStateCard regionFilter={effectiveRegionFilter} />
            <FactoriesBySpeciesCard regionFilter={effectiveRegionFilter} />
          </div>
        )
      case 'charts':
        return <DashboardCharts regionFilter={effectiveRegionFilter} />
      case 'list':
        return (
          <div className="grid grid-cols-1 gap-6 print:hidden">
            <FactoryListCard regionFilter={effectiveRegionFilter} />
          </div>
        )
      case 'historical':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
            <HistoricalComparisonCard regionFilter={effectiveRegionFilter} />
            <TimelineSummaryCard regionFilter={effectiveRegionFilter} />
          </div>
        )
      default:
        return null
    }
  }

  const isExportDisabled = exportableRows.length === 0 || isExportingCSV

  return (
    <div className="dashboard-blink-theme space-y-4 animate-fade-in pb-10 p-4 md:p-6 rounded-[12px] print:m-0 print:p-0 print:space-y-8">
      {/* Banner de erro padronizado para refreshes */}
      {isSyncError && (
        <SyncErrorBanner message="Falha ao atualizar os dados." onRetry={refetchSync} />
      )}

      <div className="hidden print:block mb-8 border-b-2 border-[#E5B64E] pb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-[#E5B64E] mb-1">Blink Biotech</h1>
            <h2 className="text-xl font-semibold mb-1 text-white">
              {viewMode === 'geographic'
                ? 'Relatório Geográfico Global'
                : viewMode === 'global'
                  ? 'Relatório Executivo Global'
                  : `Relatório Regional - ${effectiveRegionFilter}`}
            </h2>
            <p className="text-[#A1A1AA] text-sm">
              Gerado em: {new Date().toLocaleDateString('pt-BR')} às{' '}
              {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="text-right border-l-2 pl-4 border-[#3A3A42]">
            <h3 className="text-sm font-bold text-[#A1A1AA] uppercase tracking-wider">
              Filtros Aplicados
            </h3>
            <p className="text-sm font-medium">
              Região: <span className="text-[#E5B64E]">{effectiveRegionFilter}</span>
            </p>
            <p className="text-sm font-medium">
              Usuário: <span className="text-[#E5B64E]">{user?.name || user?.email || 'N/A'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Header e Topbar Strip (#44444C) */}
      <div className="blink-header-strip p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-2 print:hidden shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E85635]" title="Blink Accent" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {viewMode === 'geographic'
                ? 'Visão Geográfica'
                : viewMode === 'global'
                  ? 'Visão Global'
                  : `Visão Regional - ${effectiveRegionFilter}`}
              {lastAutomationPeriod && (
                <span className="text-xs font-normal text-[#E5B64E] ml-2">
                  • Período: {lastAutomationPeriod}
                </span>
              )}
            </h1>
          </div>

          <div className="flex gap-1 bg-[#232329] rounded-[12px] p-1 border border-[#3A3A42]">
            <Button
              size="sm"
              variant={viewMode === 'global' ? 'default' : 'ghost'}
              onClick={() => {
                setViewMode('global')
                setRegionFilter('Todas as Regiões')
              }}
              className={`gap-1.5 h-8 text-xs font-semibold rounded-[8px] transition-all ${
                viewMode === 'global'
                  ? 'bg-[#E5B64E] text-[#1F1F1F] hover:bg-[#d4a643]'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#3A3A42]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Global
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'regional' ? 'default' : 'ghost'}
              onClick={() => setViewMode('regional')}
              className={`gap-1.5 h-8 text-xs font-semibold rounded-[8px] transition-all ${
                viewMode === 'regional'
                  ? 'bg-[#E5B64E] text-[#1F1F1F] hover:bg-[#d4a643]'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#3A3A42]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" /> Regional
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'geographic' ? 'default' : 'ghost'}
              onClick={() => {
                setViewMode('geographic')
                setRegionFilter('Todas as Regiões')
              }}
              className={`gap-1.5 h-8 text-xs font-semibold rounded-[8px] transition-all ${
                viewMode === 'geographic'
                  ? 'bg-[#E5B64E] text-[#1F1F1F] hover:bg-[#d4a643]'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#3A3A42]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> Geográfico
            </Button>
          </div>
        </div>

        {/* Ações do Header (Exportar CSV alinhado à direita com estilo ouro primário) */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={handleExportCSV}
                    disabled={isExportDisabled}
                    className="blink-btn-primary gap-2 h-9 px-4 text-xs font-semibold shadow-md"
                  >
                    {isExportingCSV ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#1F1F1F]" />
                    ) : (
                      <Download className="w-4 h-4 text-[#1F1F1F]" />
                    )}
                    Exportar CSV
                  </Button>
                </span>
              </TooltipTrigger>
              {exportableRows.length === 0 && (
                <TooltipContent className="bg-[#2A2A31] border-[#3A3A42] text-white text-xs">
                  Nenhum dado para exportar com os filtros atuais
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <DashboardCustomizer blocks={blocks} onToggle={toggleBlock} onReset={reset} />

          <Button
            onClick={handleWhatsAppShare}
            className="gap-2 shadow-sm bg-[#25D366] hover:bg-[#128C7E] text-white h-9 px-3 text-xs rounded-[12px]"
          >
            <WhatsAppIcon className="w-4 h-4" /> WhatsApp
          </Button>

          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="gap-2 shadow-sm h-9 px-3 text-xs bg-[#232329] border-[#3A3A42] text-white hover:bg-[#3A3A42] rounded-[12px]"
          >
            <Download className="w-4 h-4" /> Snapshot PDF
          </Button>

          <Button
            variant="outline"
            onClick={handleTestIntegration}
            disabled={integrationLoading}
            className="gap-2 shadow-sm h-9 px-3 text-xs bg-[#232329] border-[#3A3A42] text-white hover:bg-[#3A3A42] rounded-[12px]"
          >
            {integrationLoading ? 'Testando...' : 'Testar'}
          </Button>
        </div>
      </div>

      {/* Painel de Filtros (Inputs #232329 com borda #3A3A42, gold focus ring, labels branca 13px) */}
      {viewMode !== 'geographic' && (
        <div className="bg-[#2A2A31] border border-[#3A3A42] rounded-[12px] p-4 flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-1.5 text-white text-[13px] font-medium mr-1">
            <Filter className="w-4 h-4 text-[#E5B64E]" />
            <span>Filtros Ativos:</span>
          </div>

          <UserFilter
            value={salesOwnerFilter}
            onChange={setSalesOwnerFilter}
            onOptionsLoaded={setVendedorOptions}
            className="w-[180px] h-9 bg-[#232329] border-[#3A3A42] text-white rounded-[12px] text-xs focus:ring-[#E5B64E]"
          />

          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-[150px] h-9 bg-[#232329] border-[#3A3A42] text-white rounded-[12px] text-xs focus:ring-[#E5B64E]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="bg-[#2A2A31] border-[#3A3A42] text-white">
              <SelectItem value="all">Todos os Estados</SelectItem>
              {Array.from(new Set(factories.map((f) => f.state).filter(Boolean) as string[]))
                .sort()
                .map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
            <SelectTrigger className="w-[160px] h-9 bg-[#232329] border-[#3A3A42] text-white rounded-[12px] text-xs focus:ring-[#E5B64E]">
              <SelectValue placeholder="Espécie / Segmento" />
            </SelectTrigger>
            <SelectContent className="bg-[#2A2A31] border-[#3A3A42] text-white">
              <SelectItem value="all">Todas as Espécies</SelectItem>
              {[
                'Bovinos',
                'Suínos',
                'Aves',
                'Aqua',
                'PET',
                'Equinos',
                'Caprinos',
                'Ovinos',
                'Multiespécie',
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {viewMode === 'regional' && (
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[180px] h-9 bg-[#232329] border-[#3A3A42] text-white rounded-[12px] text-xs focus:ring-[#E5B64E]">
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent className="bg-[#2A2A31] border-[#3A3A42] text-white">
                <SelectItem value="Todas as Regiões">Todas as Regiões</SelectItem>
                <SelectItem value="Norte">Norte</SelectItem>
                <SelectItem value="Sul">Sul</SelectItem>
                <SelectItem value="Médio-Norte">Médio-Norte</SelectItem>
                <SelectItem value="Oeste">Oeste</SelectItem>
                <SelectItem value="Leste">Leste</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Busca por cliente */}
          <div className="flex items-center ml-auto">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={clientSearchFilter}
              onChange={(e) => setClientSearchFilter(e.target.value)}
              className="h-9 px-3 bg-[#232329] border border-[#3A3A42] rounded-[12px] text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#E5B64E] focus:ring-1 focus:ring-[#E5B64E] w-[180px]"
            />
          </div>

          {userRegion && (
            <div
              className="text-xs text-[#A1A1AA] flex items-center gap-1.5 px-2.5 py-1 bg-[#232329] border border-[#3A3A42] rounded-[12px]"
              title={`Sua região cadastrada é ${userRegion}`}
            >
              <MapPin className="w-3.5 h-3.5 text-[#E5B64E]" />
              <span>Base: {userRegion}</span>
            </div>
          )}
        </div>
      )}

      {viewMode === 'geographic' ? (
        <GeographicOverview />
      ) : (
        <div className="flex flex-col gap-6">
          {blocks.map((blockId, index) => (
            <DraggableBlock key={blockId} id={blockId} index={index} moveBlock={moveBlock}>
              {renderBlock(blockId)}
            </DraggableBlock>
          ))}
        </div>
      )}

      <footer className="pt-4 border-t border-[#3A3A42] text-center sm:text-right">
        <p className="text-xs text-[#A1A1AA]">
          Ativo: compra ≤ 180 dias / Inativo: sem compra &gt; 180 dias • Blink Biotech Inteligência
          Comercial
        </p>
      </footer>
    </div>
  )
}
