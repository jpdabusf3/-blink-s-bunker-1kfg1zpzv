import React, { useState, useEffect } from 'react'
import { useAppContext } from '@/store/AppContext'
import { useScopedFactories } from '@/hooks/use-scoped-data'
import { useAuth } from '@/hooks/use-auth'
import { isManager } from '@/lib/user-scope'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCompactCurrency } from '@/lib/utils'
import { Download, GripVertical, Filter, Globe, MapPin, Compass } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapCard } from '@/components/dashboard/MapCard'
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
import { UserFilter } from '@/components/UserFilter'
import { testIntegration } from '@/services/integration-test'
import { toast } from 'sonner'

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)

const DEFAULT_BLOCKS = [
  'metrics',
  'executive',
  'targets',
  'role-widgets',
  'maps',
  'distribution',
  'charts',
  'historical',
  'list',
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
  const { tasks } = useAppContext()
  const factories = useScopedFactories()
  const { user } = useAuth()
  const isLeader = isManager(user)
  const userRegion = user?.geographicArea || ''

  const [regionFilter, setRegionFilter] = useState('Todas as Regiões')
  const [viewMode, setViewMode] = useState<'global' | 'regional' | 'geographic'>('global')
  const [salesOwnerFilter, setSalesOwnerFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [integrationLoading, setIntegrationLoading] = useState(false)

  const [blocks, setBlocks] = useState<string[]>(() => {
    const saved = localStorage.getItem('blink_dashboard_order_v6')
    if (saved) {
      const parsed = JSON.parse(saved)
      const valid = parsed.filter((b: string) => DEFAULT_BLOCKS.includes(b))
      const missing = DEFAULT_BLOCKS.filter((b) => !valid.includes(b))
      return [...valid, ...missing]
    }
    return DEFAULT_BLOCKS
  })

  useEffect(() => {
    localStorage.setItem('blink_dashboard_order_v6', JSON.stringify(blocks))
  }, [blocks])

  const moveBlock = (fromIndex: number, toIndex: number) => {
    const newBlocks = [...blocks]
    const [moved] = newBlocks.splice(fromIndex, 1)
    newBlocks.splice(toIndex, 0, moved)
    setBlocks(newBlocks)
  }

  const effectiveRegionFilter = isLeader ? regionFilter : userRegion || 'Todas as Regiões'

  const filteredFactories = factories.filter((f) => {
    const regionMatch =
      effectiveRegionFilter === 'Todas as Regiões' ||
      f.region === effectiveRegionFilter ||
      f.stateRegion === effectiveRegionFilter
    const ownerMatch = salesOwnerFilter === 'all' || f.salesOwner === salesOwnerFilter
    const stateMatch = stateFilter === 'all' || f.state === stateFilter
    const speciesMatch = speciesFilter === 'all' || f.animalSpecies === speciesFilter
    return regionMatch && ownerMatch && stateMatch && speciesMatch
  })

  const metrics = {
    revenue: filteredFactories.reduce((s, f) => s + f.potentialValue, 0),
    weighted: filteredFactories.reduce(
      (s, f) => s + f.potentialValue * (f.winProbability / 100),
      0,
    ),
    active: filteredFactories.filter((f) => f.status === 'Atendido').length,
    prospect: filteredFactories.filter((f) => f.status === 'Prospeção').length,
  }

  const handleExportPDF = () => {
    const originalTitle = document.title
    const safeRegion = (isLeader ? regionFilter : userRegion).replace(/\s+/g, '_')
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

  const renderBlock = (id: string) => {
    switch (id) {
      case 'executive':
        return <ExecutiveDashboardCard />
      case 'metrics':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-4 print:mb-8">
            <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-muted/10">
              <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
                Fábricas Mapeadas
              </h3>
              <div className="text-xl sm:text-3xl font-bold">{filteredFactories.length}</div>
            </Card>
            <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-muted/10">
              <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
                Ativas / Prospecção
              </h3>
              <div className="text-xl sm:text-3xl font-bold">
                {metrics.active} / {metrics.prospect}
              </div>
            </Card>
            <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-primary/5">
              <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
                Receita Potencial
              </h3>
              <div className="text-[12px] font-bold text-primary print:text-xl">
                {formatCompactCurrency(metrics.revenue)}
              </div>
            </Card>
            <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-accent/5">
              <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
                Forecast Ponderado
              </h3>
              <div className="text-[12px] font-bold text-accent print:text-xl">
                {formatCompactCurrency(metrics.weighted)}
              </div>
            </Card>
          </div>
        )
      case 'targets':
        return <TargetsCard regionFilter={effectiveRegionFilter} />
      case 'role-widgets': {
        if (isLeader && viewMode === 'global') {
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
            <MapCard regionFilter={effectiveRegionFilter} />
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
        return isLeader ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
            <HistoricalComparisonCard regionFilter={effectiveRegionFilter} />
            <TimelineSummaryCard regionFilter={effectiveRegionFilter} />
          </div>
        ) : null
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10 print:m-0 print:p-0 print:space-y-8">
      <div className="hidden print:block mb-8 border-b-2 border-primary pb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-1">Blink Biotech</h1>
            <h2 className="text-xl font-semibold mb-1">
              {isLeader && viewMode === 'geographic'
                ? 'Relatório Geográfico Global'
                : isLeader && viewMode === 'global'
                  ? 'Relatório Executivo Global'
                  : `Relatório Regional - ${effectiveRegionFilter}`}
            </h2>
            <p className="text-muted-foreground text-sm">
              Gerado em: {new Date().toLocaleDateString('pt-BR')} às{' '}
              {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="text-right border-l-2 pl-4 border-muted">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Filtros Aplicados
            </h3>
            <p className="text-sm font-medium">
              Região: <span className="text-primary">{effectiveRegionFilter}</span>
            </p>
            <p className="text-sm font-medium">
              Usuário: <span className="text-primary">{user?.name || user?.email || 'N/A'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2 print:hidden">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">
            {isLeader && viewMode === 'geographic'
              ? 'Visão Geográfica'
              : isLeader && viewMode === 'global'
                ? 'Visão Global MT'
                : `Visão Regional - ${effectiveRegionFilter}`}
          </h1>
          {isLeader && (
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                size="sm"
                variant={viewMode === 'global' ? 'default' : 'ghost'}
                onClick={() => {
                  setViewMode('global')
                  setRegionFilter('Todas as Regiões')
                }}
                className="gap-1.5 h-8"
              >
                <Globe className="w-4 h-4" /> Global
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'regional' ? 'default' : 'ghost'}
                onClick={() => setViewMode('regional')}
                className="gap-1.5 h-8"
              >
                <MapPin className="w-4 h-4" /> Regional
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'geographic' ? 'default' : 'ghost'}
                onClick={() => {
                  setViewMode('geographic')
                  setRegionFilter('Todas as Regiões')
                }}
                className="gap-1.5 h-8"
              >
                <Compass className="w-4 h-4" /> Geográfico
              </Button>
            </div>
          )}
          {isLeader && viewMode !== 'geographic' && (
            <UserFilter
              value={salesOwnerFilter}
              onChange={setSalesOwnerFilter}
              className="w-[180px] h-9"
            />
          )}
          {isLeader && viewMode !== 'geographic' && (
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
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
          )}
          {isLeader && viewMode !== 'geographic' && (
            <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Espécie" />
              </SelectTrigger>
              <SelectContent>
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
          )}
          {isLeader && viewMode === 'regional' && (
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas as Regiões">Todas as Regiões</SelectItem>
                <SelectItem value="Norte">Norte</SelectItem>
                <SelectItem value="Sul">Sul</SelectItem>
                <SelectItem value="Médio-Norte">Médio-Norte</SelectItem>
                <SelectItem value="Oeste">Oeste</SelectItem>
                <SelectItem value="Leste">Leste</SelectItem>
              </SelectContent>
            </Select>
          )}
          {!isLeader && userRegion && (
            <div className="text-sm text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-lg">
              <MapPin className="w-4 h-4" />
              {userRegion}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={handleWhatsAppShare}
            className="gap-2 shadow-sm bg-[#25D366] hover:bg-[#128C7E] text-white w-full sm:w-auto"
          >
            <WhatsAppIcon className="w-5 h-5" /> Compartilhar via WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            className="gap-2 shadow-sm w-full sm:w-auto"
          >
            <Download className="w-5 h-5 md:w-4 md:h-4" /> Exportar Snapshot PDF
          </Button>
          <Button
            variant="outline"
            onClick={handleTestIntegration}
            disabled={integrationLoading}
            className="gap-2 shadow-sm w-full sm:w-auto"
          >
            {integrationLoading ? 'Testando...' : 'Testar Integração'}
          </Button>
        </div>
      </div>

      {isLeader && viewMode === 'geographic' ? (
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
    </div>
  )
}
