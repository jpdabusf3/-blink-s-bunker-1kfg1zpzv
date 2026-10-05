import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  Upload,
  Sparkles,
  PieChart,
  Package,
  CheckCircle2,
  Calendar,
} from 'lucide-react'
import { MaestroChatPanel } from '@/components/MaestroChatPanel'
import { formatCurrency, cn } from '@/lib/utils'
import {
  fetchResumoVendas,
  type ResumoVendasResponse,
  type TopClienteItem,
  type TopFamiliaItem,
  type MetaVendedorItem,
  type VendaSegmentoItem,
  type EvolucaoMensalItem,
  type AlertaCarteiraItem,
} from '@/services/resumo-vendas'
import { useRealtime } from '@/hooks/use-realtime'
import { CODIGO_CANONICO_ROTULO } from '@/constants/familiaProdutos'
import { TodayTasksWidget } from '@/components/dashboard/TodayTasksWidget'
import { WeeklyAgendaCard } from '@/components/dashboard/WeeklyAgendaCard'

const SEGMENT_COLORS: Record<string, string> = {
  AVES: '#0284c7', // Sky
  PETS: '#10b981', // Emerald
  RUMINANTES: '#f59e0b', // Amber
  SUINOS: '#8b5cf6', // Violet
}

export default function Resumo() {
  const [data, setData] = useState<ResumoVendasResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [maestroPanelOpen, setMaestroPanelOpen] = useState(false)

  // Função central de carregamento do endpoint /backend/v1/resumo-vendas
  const loadResumo = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    setError(false)
    try {
      const resp = await fetchResumoVendas({ mode: 'month' })
      setData(resp)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Erro ao carregar resumo de vendas:', err)
      setError(true)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [])

  // Carga inicial ao montar
  useEffect(() => {
    loadResumo()
  }, [loadResumo])

  // Real-time sync: subscribe via useRealtime às coleções de faturamento, pedidos e clientes
  // On any INSERT/UPDATE/DELETE event, refetch the resumo-vendas endpoint automatically
  useRealtime('faturamento', () => void loadResumo(true))
  useRealtime('pedidos_carteira', () => void loadResumo(true))
  useRealtime('pedidos', () => void loadResumo(true))
  useRealtime('factories', () => void loadResumo(true))
  useRealtime('metas', () => void loadResumo(true))

  // Verificação de Estado EMPTY
  const isEmpty = useMemo(() => {
    if (loading || error || !data) return false
    const semFaturamento =
      (data.faturamento_mes || 0) === 0 && (data.faturamento_ano_ytd || 0) === 0
    const semClientes =
      (data.clientes_ativos || 0) === 0 && (!data.top_clientes || data.top_clientes.length === 0)
    const semCarteira = (data.carteira_total_brl || 0) === 0
    return semFaturamento && semClientes && semCarteira
  }, [loading, error, data])

  // Formatação amigável do timestamp "Atualizado agora"
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return ''
    return lastUpdated.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }, [lastUpdated])

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-primary" /> Resumo
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <span>Dashboard executivo de vendas, carteira e indicadores comerciais</span>
            {formattedLastUpdated && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/80 font-mono bg-muted/40 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Atualizado agora às{' '}
                {formattedLastUpdated}
              </span>
            )}
          </p>
        </div>

        {/* Barra de Ações */}
        <div className="flex items-center gap-2">
          {/* Botão MAESTRO */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setMaestroPanelOpen(true)}
            className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
            title="Abrir assistente MAESTRO"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">MAESTRO</span>
          </Button>

          {/* Botão Atualizar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadResumo(false)}
            disabled={loading}
            className="h-8 gap-1.5 text-xs border-border/70 bg-card/60"
            title="Atualizar dados"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* 1. ESTADO DE LOADING (Skeletons no formato exato de cards, tabelas e gráficos) */}
      {loading && !data && <DashboardSkeleton />}

      {/* 2. ESTADO DE ERRO */}
      {error && !loading && (
        <Card className="glass-card border-destructive/30 shadow-card">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-semibold text-lg text-foreground">
                Não foi possível carregar o resumo.
              </h3>
              <p className="text-sm text-muted-foreground">
                Por favor, verifique a conexão ou tente recarregar os dados.
              </p>
            </div>
            <Button onClick={() => void loadResumo(false)} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 3. ESTADO EMPTY */}
      {isEmpty && (
        <Card className="glass-card border-dashed border-border/60 shadow-card">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="w-7 h-7" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-semibold text-xl text-foreground">Sem dados ainda</h3>
              <p className="text-sm text-muted-foreground">
                Importe notas fiscais ou cadastre clientes para ver o resumo.
              </p>
            </div>
            <Button asChild size="default" className="gap-2 shadow-sm font-semibold">
              <Link to="/importar-faturamento">
                <Upload className="w-4 h-4" /> Importar Faturamento
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. ESTADO SUCCESS (fade-in animation on load) */}
      {!loading && !error && !isEmpty && data && (
        <div className="space-y-8 animate-fade-in">
          {/* Seção de Widgets de Agenda e Tarefas (preservados da interface Blink Bunker) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TodayTasksWidget />
          </div>

          <div className="w-full">
            <WeeklyAgendaCard />
          </div>

          {/* Seção "Alertas de Carteira" */}
          {data.alertas_carteira && data.alertas_carteira.length > 0 && (
            <SectionAlertasCarteira alertas={data.alertas_carteira} />
          )}

          {/* Header row of stat cards:
              "Faturamento do Mes", "Faturamento Acumulado do Ano", "Clientes Ativos", "Ticket Medio" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Card 1: Faturamento do Mês */}
            <KpiCard
              label="Faturamento do Mês"
              value={formatCurrency(data.faturamento_mes)}
              icon={DollarSign}
              borderClass="border-l-primary"
              variation={data.variacao_faturamento_mes}
              subtext="vs mês anterior"
            />

            {/* Card 2: Faturamento Acumulado do Ano */}
            <KpiCard
              label="Faturamento Acumulado do Ano"
              value={formatCurrency(data.faturamento_ano_ytd)}
              icon={TrendingUp}
              borderClass="border-l-indigo-500"
              variation={null}
              subtext="Total acumulado (YTD)"
            />

            {/* Card 3: Clientes Ativos */}
            <KpiCard
              label="Clientes Ativos"
              value={String(data.clientes_ativos || 0)}
              icon={Users}
              borderClass="border-l-sky-500"
              variation={null}
              subtext="Com compras registradas"
            />

            {/* Card 4: Ticket Médio */}
            <KpiCard
              label="Ticket Médio"
              value={formatCurrency(data.ticket_medio)}
              icon={Receipt}
              borderClass="border-l-emerald-500"
              variation={data.variacao_ticket_medio}
              subtext="vs mês anterior"
            />
          </div>

          {/* Seção "Cobertura de Carteira" */}
          <Card className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" /> Cobertura de Carteira
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Percentual comparando pedidos abertos em carteira versus meta do período
                    (carteira ÷ meta)
                  </CardDescription>
                </div>
                {data.cobertura_percent !== null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono text-xs font-bold px-2.5 py-1',
                      data.cobertura_percent >= 100
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : data.cobertura_percent >= 70
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : 'bg-destructive/10 text-destructive border-destructive/30',
                    )}
                  >
                    {data.cobertura_percent.toFixed(1).replace('.', ',')}% da Meta
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Carteira de Pedidos
                  </span>
                  <p className="text-xl font-bold font-mono text-primary">
                    {formatCurrency(data.carteira_total_brl)}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Meta do Período
                  </span>
                  <p className="text-xl font-bold font-mono text-foreground">
                    {data.meta_brl > 0 ? formatCurrency(data.meta_brl) : 'Não cadastrada'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Percentual de Cobertura
                  </span>
                  <p
                    className={cn(
                      'text-xl font-bold font-mono',
                      data.cobertura_percent === null
                        ? 'text-muted-foreground'
                        : data.cobertura_percent >= 100
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : data.cobertura_percent >= 70
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-destructive',
                    )}
                  >
                    {data.cobertura_percent !== null
                      ? `${data.cobertura_percent.toFixed(1).replace('.', ',')}%`
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Progress Bar de Cobertura */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso contra a meta comercial</span>
                  <span>{Math.min(Math.round(data.cobertura_percent || 0), 100)}%</span>
                </div>
                <Progress
                  value={Math.min(Math.max(data.cobertura_percent || 0, 0), 100)}
                  className="h-2.5 bg-muted"
                />
              </div>
            </CardContent>
          </Card>

          {/* Seção "Top Clientes" e "Top Famílias" (Top 10 cada) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Seção "Top Clientes" (Top 10) */}
            <SectionTopClientes clientes={data.top_clientes || []} />

            {/* Seção "Top Famílias" (Top 10) */}
            <SectionTopFamilias familias={data.top_familias || []} />
          </div>

          {/* Seção "Metas por Vendedor" */}
          <SectionMetasVendedor metas={data.metas_por_vendedor || []} />

          {/* Seções de Gráficos: "Vendas por Segmento" e "Evolução Mensal" */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico: Vendas por Segmento (AVES, PETS, RUMINANTES, SUINOS) */}
            <SectionVendasSegmento vendas={data.vendas_por_segmento || []} />

            {/* Gráfico: Evolução Mensal (últimos 12 meses) */}
            <SectionEvolucaoMensal evolucao={data.evolucao_mensal || []} />
          </div>
        </div>
      )}

      {/* Painel de Chat MAESTRO */}
      <MaestroChatPanel
        open={maestroPanelOpen}
        onOpenChange={setMaestroPanelOpen}
        initialPeriodInfo={{
          mode: 'month',
        }}
      />
    </div>
  )
}

/** Componente de KPI Card */
interface KpiCardProps {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  borderClass: string
  variation: number | null
  subtext: string
}

function KpiCard({ label, value, icon: Icon, borderClass, variation, subtext }: KpiCardProps) {
  return (
    <Card
      className={cn('glass-card hover-lift border-l-4 transition-all shadow-subtle', borderClass)}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </span>
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0 ml-2">
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate font-mono">
            {value}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {variation !== null && !isNaN(variation) ? (
              <>
                {variation > 0 ? (
                  <span className="inline-flex items-center font-bold text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />+
                    {variation.toFixed(1).replace('.', ',')}%
                  </span>
                ) : variation < 0 ? (
                  <span className="inline-flex items-center font-bold text-destructive">
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    {variation.toFixed(1).replace('.', ',')}%
                  </span>
                ) : (
                  <span className="inline-flex items-center font-semibold text-muted-foreground">
                    <Minus className="w-3.5 h-3.5 mr-0.5" />
                    0,0%
                  </span>
                )}
                <span className="text-muted-foreground truncate">{subtext}</span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">{subtext}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Seção: Top Clientes (Top 10 com rank, cliente, total faturado, share) */
function SectionTopClientes({ clientes }: { clientes: TopClienteItem[] }) {
  return (
    <Card className="glass-card shadow-card">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Top Clientes
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              10 maiores clientes por faturamento e representatividade na receita
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
            Top 10
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-12 text-center text-xs">Pos.</TableHead>
                <TableHead className="text-xs font-semibold">Cliente</TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                  Faturamento Total
                </TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                  Participação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                    Nenhum cliente com faturamento registrado.
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((c) => (
                  <TableRow
                    key={`client-${c.rank}-${c.cliente}`}
                    className="border-border/20 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {c.rank}º
                    </TableCell>
                    <TableCell className="font-medium text-xs text-foreground max-w-[240px] truncate">
                      {c.cliente}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                      {formatCurrency(c.valor_brl)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className="font-mono text-[11px] font-semibold bg-muted/20"
                      >
                        {c.share_percentual.toFixed(1).replace('.', ',')}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile (< 768px): Responsive Cards */}
        <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
          {clientes.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Nenhum cliente com faturamento registrado.
            </div>
          ) : (
            clientes.map((c) => (
              <div key={`mob-cli-${c.rank}-${c.cliente}`} className="pt-3 first:pt-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      {c.rank}
                    </span>
                    <span className="font-semibold text-xs text-foreground truncate max-w-[180px]">
                      {c.cliente}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] font-semibold bg-muted/20 shrink-0"
                  >
                    {c.share_percentual.toFixed(1).replace('.', ',')}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pl-7">
                  <span>Faturamento:</span>
                  <span className="font-mono font-bold text-primary">
                    {formatCurrency(c.valor_brl)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Seção: Top Famílias (Top 10 com rank, família, faturamento total, share) */
function SectionTopFamilias({ familias }: { familias: TopFamiliaItem[] }) {
  return (
    <Card className="glass-card shadow-card">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" /> Top Famílias
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              10 maiores famílias de produtos por faturamento e representatividade
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
            Top 10
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="w-12 text-center text-xs">Pos.</TableHead>
                <TableHead className="text-xs font-semibold">Família de Produtos</TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                  Faturamento Total
                </TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                  Participação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {familias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                    Nenhuma família de produtos com faturamento registrado.
                  </TableCell>
                </TableRow>
              ) : (
                familias.map((f) => (
                  <TableRow
                    key={`fam-${f.rank}-${f.familia}`}
                    className="border-border/20 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {f.rank}º
                    </TableCell>
                    <TableCell className="font-medium text-xs text-foreground">
                      {CODIGO_CANONICO_ROTULO[f.familia] || f.familia}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(f.valor_brl)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className="font-mono text-[11px] font-semibold bg-muted/20"
                      >
                        {f.share_percentual.toFixed(1).replace('.', ',')}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile (< 768px): Responsive Cards */}
        <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
          {familias.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Nenhuma família de produtos com faturamento registrado.
            </div>
          ) : (
            familias.map((f) => (
              <div key={`mob-fam-${f.rank}-${f.familia}`} className="pt-3 first:pt-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      {f.rank}
                    </span>
                    <span className="font-semibold text-xs text-foreground">
                      {CODIGO_CANONICO_ROTULO[f.familia] || f.familia}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] font-semibold bg-muted/20 shrink-0"
                  >
                    {f.share_percentual.toFixed(1).replace('.', ',')}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pl-7">
                  <span>Faturamento:</span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(f.valor_brl)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Seção: Metas por Vendedor (tabela com status badge verde >= 100%, amarelo 70-99%, vermelho < 70%) */
function SectionMetasVendedor({ metas }: { metas: MetaVendedorItem[] }) {
  return (
    <Card className="glass-card shadow-card">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Metas por Vendedor
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Acompanhamento mensal de metas comerciais por vendedor
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
            {metas.length} vendedor{metas.length === 1 ? '' : 'es'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Vendedor</TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                  Meta Mensal
                </TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                  Valor Atingido
                </TableHead>
                <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                  % Atingido
                </TableHead>
                <TableHead className="text-center text-xs font-semibold w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                    Nenhum vendedor ou meta cadastrado para o período.
                  </TableCell>
                </TableRow>
              ) : (
                metas.map((m, idx) => (
                  <TableRow
                    key={`meta-vend-${idx}`}
                    className="border-border/20 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-semibold text-xs text-foreground">
                      {m.vendedor}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {m.meta_mensal > 0 ? formatCurrency(m.meta_mensal) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-primary whitespace-nowrap">
                      {formatCurrency(m.valor_atingido)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold whitespace-nowrap">
                      {m.percentual_atingido.toFixed(1).replace('.', ',')}%
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {m.status === 'verde' ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
                          100%+ (Meta batida)
                        </Badge>
                      ) : m.status === 'amarelo' ? (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold">
                          70% - 99% (Atenção)
                        </Badge>
                      ) : (
                        <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[11px] font-semibold">
                          &lt; 70% (Crítico)
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile (< 768px): Responsive Cards */}
        <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
          {metas.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Nenhum vendedor ou meta cadastrado para o período.
            </div>
          ) : (
            metas.map((m, idx) => (
              <div key={`mob-meta-${idx}`} className="pt-3 first:pt-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-foreground">{m.vendedor}</span>
                  {m.status === 'verde' ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                      100%+
                    </Badge>
                  ) : m.status === 'amarelo' ? (
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
                      70-99%
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-semibold">
                      &lt; 70%
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Meta: </span>
                    <span className="font-mono font-medium">
                      {m.meta_mensal > 0 ? formatCurrency(m.meta_mensal) : '—'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Atingido: </span>
                    <span className="font-mono font-bold text-primary">
                      {formatCurrency(m.valor_atingido)}
                    </span>
                  </div>
                </div>
                <div className="text-xs flex justify-between items-center text-muted-foreground pt-1 border-t border-border/20">
                  <span>Percentual alcançado:</span>
                  <span className="font-mono font-bold text-foreground">
                    {m.percentual_atingido.toFixed(1).replace('.', ',')}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** Seção: Alertas de Carteira (ícone de severidade, mensagem em português e data DD/MM/YYYY) */
function SectionAlertasCarteira({ alertas }: { alertas: AlertaCarteiraItem[] }) {
  const formatDateBR = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      if (isNaN(d.getTime())) return isoStr
      return d.toLocaleDateString('pt-BR')
    } catch (_) {
      return isoStr
    }
  }

  return (
    <Card className="glass-card shadow-card border-l-4 border-l-amber-500">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Alertas de Carteira
          </CardTitle>
          <Badge
            variant="outline"
            className="text-xs font-semibold bg-amber-500/10 text-amber-600 border-amber-500/30"
          >
            {alertas.length} alerta{alertas.length === 1 ? '' : 's'}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-0.5">
          Avisos operacionais de cobertura, inatividade de clientes e segmentos zerados
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-2.5">
        {alertas.map((alerta) => {
          const isCritical = alerta.severidade === 'critical'
          const isWarning = alerta.severidade === 'warning'
          return (
            <div
              key={alerta.id}
              className={cn(
                'flex items-start justify-between gap-3 p-3 rounded-lg border text-xs transition-colors',
                isCritical
                  ? 'bg-destructive/10 border-destructive/30 text-destructive-foreground'
                  : isWarning
                    ? 'bg-amber-500/10 border-amber-500/30 text-foreground'
                    : 'bg-muted/40 border-border/40 text-foreground',
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {isCritical ? (
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                )}
                <span className="font-medium leading-relaxed">{alerta.mensagem}</span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap shrink-0 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDateBR(alerta.data)}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/** Seção: Vendas por Segmento (gráfico de barras para AVES, PETS, RUMINANTES, SUINOS) */
function SectionVendasSegmento({ vendas }: { vendas: VendaSegmentoItem[] }) {
  const chartData = useMemo(() => {
    return vendas.map((v) => ({
      segmento: v.segmento,
      'Ano Atual': v.valor_ano,
      'Mês Atual': v.valor_mes,
    }))
  }, [vendas])

  return (
    <Card className="glass-card shadow-card">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" /> Vendas por Segmento
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Faturamento por espécie animal (AVES, PETS, RUMINANTES, SUINOS) no ano corrente
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="w-full h-[290px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 15, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="segmento"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) =>
                  v >= 1e6
                    ? `${(v / 1e6).toFixed(1)}M`
                    : v >= 1e3
                      ? `${(v / 1e3).toFixed(0)}k`
                      : String(v)
                }
              />
              <RechartsTooltip
                formatter={(val: number | string | undefined) => [
                  formatCurrency(Number(val) || 0),
                  'Faturamento',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Bar
                dataKey="Ano Atual"
                name="Faturamento no Ano"
                fill="#0284c7"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="Mês Atual"
                name="Faturamento no Mês"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

/** Seção: Evolução Mensal (gráfico de linha com receita dos últimos 12 meses) */
function SectionEvolucaoMensal({ evolucao }: { evolucao: EvolucaoMensalItem[] }) {
  return (
    <Card className="glass-card shadow-card">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Evolução Mensal
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Receita mensal faturada ao longo dos últimos 12 meses
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="w-full h-[290px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucao} margin={{ top: 15, right: 15, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v) =>
                  v >= 1e6
                    ? `${(v / 1e6).toFixed(1)}M`
                    : v >= 1e3
                      ? `${(v / 1e3).toFixed(0)}k`
                      : String(v)
                }
              />
              <RechartsTooltip
                formatter={(val: number | string | undefined) => [
                  formatCurrency(Number(val) || 0),
                  'Faturamento',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              <Line
                type="monotone"
                dataKey="valor_brl"
                name="Faturamento (R$)"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#0284c7' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

/** DashboardSkeleton: esqueleto visual que mimetiza os 4 cards, cobertura, tabelas e gráficos */
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-shimmer">
      {/* 4 Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={`kpi-skel-${i}`} className="glass-card shadow-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3.5 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cobertura Skeleton */}
      <Card className="glass-card shadow-card p-5 space-y-4">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </Card>

      {/* 2 Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={`tab-skel-${i}`} className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56 mt-1" />
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2 Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={`chart-skel-${i}`} className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64 mt-1" />
            </CardHeader>
            <CardContent className="p-4 flex items-center justify-center h-[290px]">
              <Skeleton className="h-full w-full rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
