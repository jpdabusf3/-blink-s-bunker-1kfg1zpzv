import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  PackageCheck,
  Clock,
  RotateCw,
  AlertCircle,
  FileText,
  Layers,
  Inbox,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRealtimeData } from '@/hooks/useRealtimeData'
import { formatCurrency, formatCurrencyUSD } from '@/lib/utils'
import {
  fetchClientDashboardData,
  type ClientDashboardData,
  type ClientDashboardOrder,
  type ClientDashboardBacklogItem,
  type ClientDashboardInteraction,
} from '@/services/client-dashboard'

type PeriodControl = 'monthly' | 'quarterly' | 'yearly' | 'custom'

const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ClientDashboardData | null>(null)

  // Controles de período dos gráficos
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const [period, setPeriod] = useState<PeriodControl>('monthly')
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [customStartDate, setCustomStartDate] = useState<string>(`${currentYear}-01-01`)
  const [customEndDate, setCustomEndDate] = useState<string>(`${currentYear}-12-31`)

  // Carregar dados com tratamento de erro
  const loadDashboard = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchClientDashboardData(id)
      setData(result)
    } catch (err) {
      console.error('[ClientDashboard] Falha ao carregar dashboard do cliente:', err)
      setError('Não foi possível carregar o dashboard do cliente.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  // Real-time sync: segue o padrão existente do useRealtimeData
  useRealtimeData('factories', loadDashboard)
  useRealtimeData('faturamento', loadDashboard)
  useRealtimeData('pedidos', loadDashboard)
  useRealtimeData('orders', loadDashboard)
  useRealtimeData('pedidos_carteira', loadDashboard)
  useRealtimeData('activity_logs', loadDashboard)
  useRealtimeData('deal_activities', loadDashboard)
  useRealtimeData('atividades', loadDashboard)

  // ==========================================
  // Agregação de Gráficos (Faturamento e Volume)
  // ==========================================
  const chartData = useMemo(() => {
    if (!data) return []

    // 1. Mensal para o ano selecionado (Default: ano corrente)
    if (period === 'monthly') {
      const months = Array.from({ length: 12 }, (_, i) => ({
        label: MONTH_NAMES_SHORT[i],
        mesNum: i + 1,
        faturamento: 0,
        volume: 0,
      }))

      for (const inv of data.invoices) {
        if (inv.ano === selectedYear && inv.mes >= 1 && inv.mes <= 12) {
          months[inv.mes - 1].faturamento += inv.valorBrl
          months[inv.mes - 1].volume += inv.volume
        }
      }

      // Se faturamento não tiver dados mas houver pedidos para este ano
      if (months.every((m) => m.faturamento === 0)) {
        for (const ord of data.orders) {
          const d = new Date(ord.date)
          if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
            const mIdx = d.getMonth()
            if (mIdx >= 0 && mIdx < 12) {
              months[mIdx].faturamento += ord.value
              months[mIdx].volume += 1
            }
          }
        }
      }

      return months
    }

    // 2. Trimestral
    if (period === 'quarterly') {
      const quarters = [
        { label: '1º Trimestre', quarter: 1, faturamento: 0, volume: 0 },
        { label: '2º Trimestre', quarter: 2, faturamento: 0, volume: 0 },
        { label: '3º Trimestre', quarter: 3, faturamento: 0, volume: 0 },
        { label: '4º Trimestre', quarter: 4, faturamento: 0, volume: 0 },
      ]

      for (const inv of data.invoices) {
        if (inv.ano === selectedYear) {
          const qIdx = Math.min(3, Math.floor((inv.mes - 1) / 3))
          quarters[qIdx].faturamento += inv.valorBrl
          quarters[qIdx].volume += inv.volume
        }
      }

      if (quarters.every((q) => q.faturamento === 0)) {
        for (const ord of data.orders) {
          const d = new Date(ord.date)
          if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
            const qIdx = Math.min(3, Math.floor(d.getMonth() / 3))
            quarters[qIdx].faturamento += ord.value
            quarters[qIdx].volume += 1
          }
        }
      }

      return quarters
    }

    // 3. Anual (últimos 4 anos)
    if (period === 'yearly') {
      const yearsMap = new Map<number, { faturamento: number; volume: number }>()
      const baseYears = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear]
      baseYears.forEach((y) => yearsMap.set(y, { faturamento: 0, volume: 0 }))

      for (const inv of data.invoices) {
        if (!yearsMap.has(inv.ano)) {
          yearsMap.set(inv.ano, { faturamento: 0, volume: 0 })
        }
        const cur = yearsMap.get(inv.ano)!
        cur.faturamento += inv.valorBrl
        cur.volume += inv.volume
      }

      for (const ord of data.orders) {
        const d = new Date(ord.date)
        if (!isNaN(d.getTime())) {
          const ordYear = d.getFullYear()
          if (!yearsMap.has(ordYear)) {
            yearsMap.set(ordYear, { faturamento: 0, volume: 0 })
          }
          // se faturamento deste ano for 0
          if (yearsMap.get(ordYear)!.faturamento === 0) {
            yearsMap.get(ordYear)!.faturamento += ord.value
            yearsMap.get(ordYear)!.volume += 1
          }
        }
      }

      return Array.from(yearsMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([year, values]) => ({
          label: String(year),
          faturamento: values.faturamento,
          volume: values.volume,
        }))
    }

    // 4. Período Customizado
    if (period === 'custom') {
      const start = new Date(customStartDate).getTime()
      const end = new Date(customEndDate).getTime() + 86400000 // inclusivo

      const aggregatedByMonth = new Map<string, { faturamento: number; volume: number }>()

      for (const inv of data.invoices) {
        const invTime = new Date(inv.date).getTime()
        if (invTime >= start && invTime <= end) {
          const key = `${MONTH_NAMES_SHORT[inv.mes - 1]}/${String(inv.ano).slice(2)}`
          if (!aggregatedByMonth.has(key)) {
            aggregatedByMonth.set(key, { faturamento: 0, volume: 0 })
          }
          const cur = aggregatedByMonth.get(key)!
          cur.faturamento += inv.valorBrl
          cur.volume += inv.volume
        }
      }

      if (aggregatedByMonth.size === 0) {
        for (const ord of data.orders) {
          const ordTime = new Date(ord.date).getTime()
          if (ordTime >= start && ordTime <= end) {
            const d = new Date(ord.date)
            const key = `${MONTH_NAMES_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
            if (!aggregatedByMonth.has(key)) {
              aggregatedByMonth.set(key, { faturamento: 0, volume: 0 })
            }
            const cur = aggregatedByMonth.get(key)!
            cur.faturamento += ord.value
            cur.volume += 1
          }
        }
      }

      if (aggregatedByMonth.size === 0) {
        return [{ label: 'Sem registros no período', faturamento: 0, volume: 0 }]
      }

      return Array.from(aggregatedByMonth.entries()).map(([label, values]) => ({
        label,
        faturamento: values.faturamento,
        volume: values.volume,
      }))
    }

    return []
  }, [data, period, selectedYear, customStartDate, customEndDate, currentYear])

  // Anos disponíveis para filtro
  const availableYears = useMemo(() => {
    if (!data) return [currentYear]
    const set = new Set<number>([currentYear])
    data.invoices.forEach((inv) => set.add(inv.ano))
    data.orders.forEach((ord) => {
      const d = new Date(ord.date)
      if (!isNaN(d.getTime())) set.add(d.getFullYear())
    })
    return Array.from(set).sort((a, b) => b - a)
  }, [data, currentYear])

  // ==========================================
  // ESTADO 1: LOADING (Skeletons)
  // ==========================================
  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>

        {/* 5 Summary Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={`kpi-skel-${i}`} className="glass-card shadow-xs">
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Section Skeleton */}
        <Card className="glass-card shadow-xs p-6 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-8 w-60" />
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </Card>

        {/* Tables Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card shadow-xs p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
          <Card className="glass-card shadow-xs p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        </div>
      </div>
    )
  }

  // ==========================================
  // ESTADO 3: ERROR (Mensagem amigável com retry)
  // ==========================================
  if (error || !data) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">
              {error || 'Não foi possível carregar o dashboard do cliente.'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu uma instabilidade momentânea na conexão. Você pode tentar recarregar os dados
              agora.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/funil')} className="gap-2 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao funil
            </Button>
            <Button onClick={loadDashboard} className="gap-2 text-xs">
              <RotateCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ==========================================
  // ESTADO 2: EMPTY
  // ==========================================
  if (data.isEmpty) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <Card className="border-dashed p-10 text-center space-y-5 bg-card/50">
          <div className="w-14 h-14 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
            <Inbox className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-foreground">
              Nenhum dado registrado para este cliente ainda
            </h2>
            <p className="text-xs text-muted-foreground">
              O cliente <strong className="text-foreground">{data.client.name}</strong> ainda não
              possui pedidos, faturamento ou interações comerciais registradas.
            </p>
          </div>
          <div className="pt-2">
            <Button onClick={() => navigate('/funil')} className="gap-2 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Funil
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ==========================================
  // ESTADO 4: SUCCESS (Dashboard Completo)
  // ==========================================
  const client = data.client
  const funnelStage = client.funnelStage || client.status_funil || 'Lead'
  const segment = client.carteira || client.grupo_cliente || 'Geral'

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6 animate-in fade-in duration-300">
      {/* 1. HEADER DO CLIENTE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/funil')}
              className="gap-1.5 text-xs h-8"
              aria-label="Voltar para o funil"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Funil
            </Button>

            <Badge
              variant="secondary"
              className="font-semibold text-xs px-2.5 py-0.5 bg-primary/10 text-primary border-primary/20"
            >
              Estágio: {funnelStage}
            </Badge>

            {client.profile_type && (
              <Badge variant="outline" className="text-xs">
                {client.profile_type}
              </Badge>
            )}

            {segment && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {segment}
              </Badge>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2 mt-1">
            <Building2 className="w-6 h-6 text-primary shrink-0" />
            <span className="truncate">{client.name}</span>
          </h1>

          <p className="text-xs text-muted-foreground">
            {client.city && client.state
              ? `${client.city} - ${client.state}`
              : 'Localidade não informada'}
            {client.cnpj ? ` • CNPJ: ${client.cnpj}` : ''}
            {(client as any).codigo_cliente ? ` • Código: ${(client as any).codigo_cliente}` : ''}
            {' • Vendedor Canônico: João Figueiredo'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDashboard}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
            title="Atualizar dados do dashboard"
          >
            <RotateCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      {/* 2. SUMMARY CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Orders */}
        <Card className="glass-card shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total de Pedidos</span>
              <PackageCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {data.summary.totalOrdersCount}
            </div>
            <p className="text-[11px] text-muted-foreground">Pedidos emitidos ou faturados</p>
          </CardContent>
        </Card>

        {/* Card 2: Backlog (Carteira) */}
        <Card className="glass-card shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Pedidos em Carteira
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {data.summary.backlogCount}
            </div>
            <p className="text-[11px] text-muted-foreground">Em backlog / entrega futura</p>
          </CardContent>
        </Card>

        {/* Card 3: Receita Total em BRL */}
        <Card className="glass-card shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Faturamento (BRL)
              </span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              {formatCurrency(data.summary.totalRevenueBrl)}
            </div>
            <p className="text-[11px] text-muted-foreground">Receita total liquidada</p>
          </CardContent>
        </Card>

        {/* Card 4: Compras em USD */}
        <Card className="glass-card shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Faturamento (USD)
              </span>
              <DollarSign className="w-4 h-4 text-sky-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400 truncate">
              {formatCurrencyUSD(data.summary.totalPurchasesUsd)}
            </div>
            <p className="text-[11px] text-muted-foreground">Total convertido em dólar</p>
          </CardContent>
        </Card>

        {/* Card 5: Ticket Médio BRL */}
        <Card className="glass-card shadow-xs hover:border-primary/40 transition-colors sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Ticket Médio</span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 truncate">
              {formatCurrency(data.summary.averageTicketBrl)}
            </div>
            <p className="text-[11px] text-muted-foreground">Média em BRL por pedido</p>
          </CardContent>
        </Card>
      </div>

      {/* 6. CHARTS SECTION COM CONTROLE DE PERÍODO */}
      <Card className="glass-card shadow-card">
        <CardHeader className="pb-3 border-b border-border/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Faturamento e Volume Faturado
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Valores de receita (R$) e volume faturado ao longo do período selecionado
              </CardDescription>
            </div>

            {/* Controles de Período */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setPeriod('monthly')}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors font-medium ${
                    period === 'monthly'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('quarterly')}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors font-medium ${
                    period === 'quarterly'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Trimestral
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('yearly')}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors font-medium ${
                    period === 'yearly'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Anual
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('custom')}
                  className={`px-2.5 py-1 text-xs rounded-sm transition-colors font-medium ${
                    period === 'custom'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {/* Seletor de Ano quando mensal ou trimestral */}
              {(period === 'monthly' || period === 'quarterly') && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Ano:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="h-8 px-2 text-xs rounded-md border bg-background text-foreground focus:outline-hidden"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom Date Range Picker */}
              {period === 'custom' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-muted-foreground">De:</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-muted-foreground">Até:</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 text-xs w-32"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 15, left: -5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                {/* Eixo Y da Esquerda: Faturamento R$ */}
                <YAxis
                  yAxisId="left"
                  orientation="left"
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
                {/* Eixo Y da Direita: Volume (quantidade) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  formatter={(val: number | string | undefined, name: string | undefined) => {
                    const num = Number(val) || 0
                    if (name === 'Faturamento (R$)') {
                      return [formatCurrency(num), 'Receita']
                    }
                    return [`${num} un`, 'Volume Faturado']
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar
                  yAxisId="left"
                  dataKey="faturamento"
                  name="Faturamento (R$)"
                  fill="#0284c7"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  yAxisId="right"
                  dataKey="volume"
                  name="Volume Faturado"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 3 & 4. SEÇÕES DE PEDIDOS E BACKLOG (Responsive: cards abaixo de 768px) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. ORDERS SECTION */}
        <Card className="glass-card shadow-card">
          <CardHeader className="pb-3 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary" /> Pedidos Realizados (
                  {data.orders.length})
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Relação de pedidos com data, valor e status
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {data.orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                Nenhum pedido registrado para este cliente.
              </div>
            ) : (
              <div>
                {/* Desktop view: Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 font-medium">Data</th>
                        <th className="pb-2 font-medium">Pedido / Item</th>
                        <th className="pb-2 font-medium text-right">Valor</th>
                        <th className="pb-2 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-muted/20">
                          <td className="py-2.5 font-mono text-muted-foreground">
                            {ord.formattedDate}
                          </td>
                          <td className="py-2.5">
                            <span className="font-semibold text-foreground block">
                              {ord.numero}
                            </span>
                            {ord.productName && (
                              <span className="text-[11px] text-muted-foreground truncate max-w-xs block">
                                {ord.productName}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-semibold tabular-nums text-foreground">
                            {formatCurrency(ord.value)}
                          </td>
                          <td className="py-2.5 text-right">
                            <Badge
                              variant={
                                ord.status === 'FATURADO' || ord.status === 'CONCLUÍDO'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="text-[10px] uppercase font-mono"
                            >
                              {ord.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view: Stacked Cards (< 768px) */}
                <div className="md:hidden space-y-2.5">
                  {data.orders.map((ord) => (
                    <div
                      key={`mob-${ord.id}`}
                      className="p-3 rounded-lg border bg-card/60 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{ord.numero}</span>
                        <Badge
                          variant={
                            ord.status === 'FATURADO' || ord.status === 'CONCLUÍDO'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-[10px] uppercase font-mono"
                        >
                          {ord.status}
                        </Badge>
                      </div>
                      {ord.productName && (
                        <p className="text-[11px] text-muted-foreground">{ord.productName}</p>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[11px]">
                        <span className="text-muted-foreground">{ord.formattedDate}</span>
                        <span className="font-bold text-foreground tabular-nums">
                          {formatCurrency(ord.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. BACKLOG SECTION */}
        <Card className="glass-card shadow-card">
          <CardHeader className="pb-3 border-b border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" /> Backlog / Carteira (
                  {data.backlog.length})
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Pedidos pendentes com previsão de entrega e valor
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {data.backlog.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                Nenhum pedido em carteira / backlog para este cliente.
              </div>
            ) : (
              <div>
                {/* Desktop view: Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="pb-2 font-medium">Previsão Entrega</th>
                        <th className="pb-2 font-medium">Identificador</th>
                        <th className="pb-2 font-medium text-right">Valor</th>
                        <th className="pb-2 font-medium text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {data.backlog.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="py-2.5 font-medium text-foreground capitalize">
                            {item.expectedDeliveryMonth}
                          </td>
                          <td className="py-2.5">
                            <span className="font-semibold text-foreground block">
                              {item.orderNumber || 'Pedido em Carteira'}
                            </span>
                            {item.product && (
                              <span className="text-[11px] text-muted-foreground block truncate max-w-xs">
                                {item.product}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-semibold tabular-nums text-foreground">
                            {formatCurrency(item.value)}
                          </td>
                          <td className="py-2.5 text-right">
                            <Badge
                              variant="outline"
                              className="text-[10px] uppercase font-mono border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                            >
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view: Stacked Cards (< 768px) */}
                <div className="md:hidden space-y-2.5">
                  {data.backlog.map((item) => (
                    <div
                      key={`mob-backlog-${item.id}`}
                      className="p-3 rounded-lg border bg-card/60 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {item.orderNumber || 'Pedido em Carteira'}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase font-mono border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[11px]">
                        <span className="text-muted-foreground capitalize">
                          Previsão: {item.expectedDeliveryMonth}
                        </span>
                        <span className="font-bold text-foreground tabular-nums">
                          {formatCurrency(item.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. INTERACTIONS SECTION (Activity Logs + Atualização Manual) */}
      <Card className="glass-card shadow-card">
        <CardHeader className="pb-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Histórico de Interações e Atualizações
                ({data.interactions.length})
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Relação cronológica de ligações, notas, follow-ups e atualizações manuais (mais
                recentes primeiro)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {data.interactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              Nenhuma interação registrada ainda para este cliente.
            </div>
          ) : (
            <div className="space-y-3">
              {data.interactions.map((inter) => (
                <div
                  key={inter.id}
                  className={`p-3.5 rounded-lg border text-xs space-y-1 transition-colors ${
                    inter.isManualUpdate
                      ? 'bg-primary/5 border-primary/30 hover:border-primary/50'
                      : 'bg-card hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {inter.isManualUpdate ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-primary/15 text-primary border-primary/20 gap-1"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {inter.fieldName || 'Atualização Manual'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {inter.type}
                        </Badge>
                      )}
                      <span className="font-semibold text-foreground text-sm">{inter.action}</span>
                    </div>

                    <span className="text-[11px] text-muted-foreground font-mono shrink-0 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {inter.formattedDate}
                    </span>
                  </div>

                  {inter.details && inter.details !== inter.action && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed pt-0.5">
                      {inter.details}
                    </p>
                  )}

                  <div className="text-[10px] text-muted-foreground pt-1 flex items-center justify-between border-t border-border/20">
                    <span>
                      Registrado por:{' '}
                      <strong className="text-foreground font-medium">
                        {inter.userOrAuthor || 'João Figueiredo'}
                      </strong>
                    </span>
                    <span className="capitalize text-[10px] opacity-75">
                      {inter.source === 'manual_update' ? 'Atualização Manual' : inter.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
