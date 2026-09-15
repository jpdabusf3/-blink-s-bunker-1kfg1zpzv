import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  DollarSign,
  ShoppingCart,
  Receipt,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  AlertCircle,
  Inbox,
  TrendingUp,
  Package,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Printer,
  CalendarDays,
  Sparkles,
} from 'lucide-react'
import { MaestroChatPanel } from '@/components/MaestroChatPanel'
import { formatCurrency, cn } from '@/lib/utils'
import {
  fetchResumoVendas,
  type ResumoVendasResponse,
  type ResumoClienteItem,
  type ResumoFamiliaItem,
} from '@/services/resumo-vendas'
import { familiaCompleta } from '@/constants/familiaProdutos'
import {
  exportResumoVendasToPDF,
  type MonthCoverageExportItem,
  type ResumoPdfExportOptions,
} from '@/lib/exportResumoVendas'
import { useDataSync } from '@/hooks/useDataSync'
import { SyncErrorBanner } from '@/components/SyncErrorBanner'

interface MonthCoverageItem {
  ano: number
  mes: number
  mesNome: string
  label: string
  faturadoBrl: number
  carteiraBrl: number | null
  coberturaPercent: number | null
}

const MONTH_NAMES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const ROWS_PER_PAGE = 10

function getIsoWeek(dateObj: Date): number {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export default function Resumo() {
  const currentDate = useMemo(() => new Date(), [])
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const currentIsoWeek = useMemo(() => getIsoWeek(new Date()), [])

  // Estados dos filtros de período
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth)
  const [selectedWeek, setSelectedWeek] = useState<number>(currentIsoWeek)

  const [clientsPage, setClientsPage] = useState<number>(1)
  const [familiesPage, setFamiliesPage] = useState<number>(1)

  // Estado do painel MAESTRO
  const [maestroPanelOpen, setMaestroPanelOpen] = useState<boolean>(false)

  // Estados do Modal de Exportação PDF
  const [pdfDialogOpen, setPdfDialogOpen] = useState<boolean>(false)
  const [pdfOptions, setPdfOptions] = useState<ResumoPdfExportOptions>({
    includeCards: true,
    includeTopClientes: true,
    includeTopFamilias: true,
    includeCobertura: true,
  })
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false)

  // Lista de anos para os seletores (2 anos no passado até 1 ano no futuro)
  const availableYears = useMemo(() => {
    const list: number[] = []
    for (let y = currentYear - 3; y <= currentYear + 2; y++) {
      list.push(y)
    }
    return list
  }, [currentYear])

  // Lista de semanas (1 a 53)
  const availableWeeks = useMemo(() => {
    const list: number[] = []
    for (let w = 1; w <= 53; w++) {
      list.push(w)
    }
    return list
  }, [])

  // Hook central de sincronização de dados
  const {
    data: fetchedData,
    isLoading: loading,
    isRefreshing,
    isError: error,
    refetch: loadData,
  } = useDataSync<{
    resumo: ResumoVendasResponse
    coverage: MonthCoverageItem[]
  }>({
    entities: ['faturamento', 'historico_vendas', 'pedidos_carteira', 'factories'],
    fetcher: async () => {
      // 1. Fetch do período selecionado
      const params =
        mode === 'month'
          ? { mode: 'month' as const, ano: selectedYear, mes: selectedMonth }
          : { mode: 'week' as const, ano: selectedYear, semana: selectedWeek }

      const currentRes = await fetchResumoVendas(params)

      // 2. Extrair ano e mês de referência para a cobertura dos últimos 6 meses
      let refYear = selectedYear
      let refMonth = mode === 'month' ? selectedMonth : currentMonth

      if (currentRes.periodo && currentRes.periodo.includes('-')) {
        const parts = currentRes.periodo.split('-')
        const py = parseInt(parts[0], 10)
        if (!isNaN(py) && py > 0) refYear = py

        if (mode === 'month' && parts.length >= 2) {
          const pm = parseInt(parts[1], 10)
          if (!isNaN(pm) && pm >= 1 && pm <= 12) refMonth = pm
        }
      }

      const monthTargets: { ano: number; mes: number }[] = []
      for (let i = 5; i >= 0; i--) {
        let m = refMonth - i
        let y = refYear
        while (m <= 0) {
          m += 12
          y -= 1
        }
        monthTargets.push({ ano: y, mes: m })
      }

      const coverageResults = await Promise.all(
        monthTargets.map(async (t) => {
          try {
            const res = await fetchResumoVendas({ mode: 'month', ano: t.ano, mes: t.mes })
            return {
              ano: t.ano,
              mes: t.mes,
              mesNome: MONTH_NAMES[t.mes] || `Mês ${t.mes}`,
              label: `${MONTH_NAMES[t.mes] || `Mês ${t.mes}`} / ${t.ano}`,
              faturadoBrl: res.faturado_total_brl ?? 0,
              carteiraBrl: res.carteira_total_brl ?? null,
              coberturaPercent:
                res.cobertura_percent !== undefined && res.cobertura_percent !== null
                  ? res.cobertura_percent
                  : res.carteira_total_brl && res.carteira_total_brl > 0
                    ? Math.round((res.faturado_total_brl / res.carteira_total_brl) * 10000) / 100
                    : null,
            }
          } catch {
            return {
              ano: t.ano,
              mes: t.mes,
              mesNome: MONTH_NAMES[t.mes] || `Mês ${t.mes}`,
              label: `${MONTH_NAMES[t.mes] || `Mês ${t.mes}`} / ${t.ano}`,
              faturadoBrl: 0,
              carteiraBrl: null,
              coberturaPercent: null,
            }
          }
        }),
      )

      return {
        resumo: currentRes,
        coverage: coverageResults,
      }
    },
  })

  // Disparar refetch se os filtros de mês/semana mudarem
  useEffect(() => {
    void loadData()
    setClientsPage(1)
    setFamiliesPage(1)
  }, [mode, selectedYear, selectedMonth, selectedWeek, loadData])

  const data = fetchedData?.resumo || null
  const coverageData = fetchedData?.coverage || []

  // KPIs
  const faturadoBrl = data?.faturado_total_brl ?? 0
  const qtdNotas = data?.quantidade_notas ?? 0
  const ticketMedio = qtdNotas > 0 ? faturadoBrl / qtdNotas : null

  // Número de clientes ativos (distintos)
  const clientesAtivos = useMemo(() => {
    if (!data?.por_cliente) return null
    return data.por_cliente.length
  }, [data])

  // Variação vs período anterior
  const variacaoPercent: number | null = useMemo(() => {
    if (!data) return null
    const raw =
      data.variacao_vs_anterior_percent ??
      data.variacao_semana_anterior ??
      (data as unknown as { variacao?: number | null }).variacao ??
      null
    return typeof raw === 'number' && !isNaN(raw) ? raw : null
  }, [data])

  // Top 10 Clientes (ordenados por faturado desc)
  const top10Clientes: ResumoClienteItem[] = useMemo(() => {
    if (!data?.por_cliente) return []
    const sorted = [...data.por_cliente].sort((a, b) => b.valor_brl - a.valor_brl)
    return sorted.slice(0, 10)
  }, [data])

  // Top Famílias (ordenadas por faturado desc)
  const topFamilias: ResumoFamiliaItem[] = useMemo(() => {
    if (!data?.por_familia) return []
    const sorted = [...data.por_familia].sort((a, b) => b.valor_brl - a.valor_brl)
    return sorted
  }, [data])

  // Paginação Clientes
  const totalClientsPages = Math.max(1, Math.ceil(top10Clientes.length / ROWS_PER_PAGE))
  const paginatedClients = useMemo(() => {
    const start = (clientsPage - 1) * ROWS_PER_PAGE
    return top10Clientes.slice(start, start + ROWS_PER_PAGE)
  }, [top10Clientes, clientsPage])

  // Paginação Famílias
  const totalFamiliesPages = Math.max(1, Math.ceil(topFamilias.length / ROWS_PER_PAGE))
  const paginatedFamilies = useMemo(() => {
    const start = (familiesPage - 1) * ROWS_PER_PAGE
    return topFamilias.slice(start, start + ROWS_PER_PAGE)
  }, [topFamilias, familiesPage])

  // Formatação percentual PT-BR
  const formatPercentBR = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return '—'
    return `${val.toFixed(1).replace('.', ',')}%`
  }

  // Identificação do estado EMPTY
  const isEmpty =
    !loading &&
    !error &&
    data !== null &&
    faturadoBrl === 0 &&
    qtdNotas === 0 &&
    top10Clientes.length === 0 &&
    topFamilias.length === 0

  // Disparo da geração de PDF
  const handleGeneratePdf = () => {
    if (!data) return

    // Pelo menos uma seção deve estar marcada
    if (
      !pdfOptions.includeCards &&
      !pdfOptions.includeTopClientes &&
      !pdfOptions.includeTopFamilias &&
      !pdfOptions.includeCobertura
    ) {
      toast.error('Selecione ao menos uma seção para incluir no relatório.')
      return
    }

    try {
      setIsExportingPdf(true)
      const exportCoverage: MonthCoverageExportItem[] = coverageData.map((c) => ({
        ano: c.ano,
        mes: c.mes,
        label: c.label,
        faturadoBrl: c.faturadoBrl,
        carteiraBrl: c.carteiraBrl,
        coberturaPercent: c.coberturaPercent,
      }))

      exportResumoVendasToPDF(
        {
          periodo: data.periodo || `${selectedYear}-${selectedMonth}`,
          faturadoBrl,
          qtdNotas,
          ticketMedio,
          clientesAtivos,
          top10Clientes,
          topFamilias,
          coverageData: exportCoverage,
        },
        pdfOptions,
      )

      toast.success('PDF gerado.')
      setPdfDialogOpen(false)
    } catch (err: unknown) {
      console.error('Erro ao gerar PDF do resumo:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao gerar o documento PDF.'
      toast.error(msg)
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Resumo de Vendas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada de receita, volume de pedidos, ticket médio e cobertura de carteira
          </p>
        </div>

        {/* Barra de Ações: Filtro de Período e Botões */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Seletor de Modo (Mês ou Semana) */}
          <div className="flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setMode('month')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                mode === 'month'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setMode('week')}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-md transition-all',
                mode === 'week'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Semana
            </button>
          </div>

          {/* Seletores dinâmicos conforme o modo */}
          {mode === 'month' ? (
            <div className="flex items-center gap-1.5">
              {/* Select Mês */}
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => setSelectedMonth(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[125px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.slice(1).map((nome, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)} className="text-xs">
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Select Ano */}
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[88px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {/* Select Semana */}
              <Select
                value={String(selectedWeek)}
                onValueChange={(val) => setSelectedWeek(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[115px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent>
                  {availableWeeks.map((sem) => (
                    <SelectItem key={sem} value={String(sem)} className="text-xs">
                      Semana {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Select Ano */}
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
              >
                <SelectTrigger className="h-8 w-[88px] text-xs bg-card/60 border-border/70">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((ano) => (
                    <SelectItem key={ano} value={String(ano)} className="text-xs">
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Período resolvido pela API */}
          {data?.periodo && !loading && !error && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/15 text-primary border border-primary/30"
              title="Período retornado pela API"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{data.periodo}</span>
            </div>
          )}

          {/* Botão Gerar Relatório com MAESTRO */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setMaestroPanelOpen(true)}
            className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Abrir assistente MAESTRO para montar relatório de vendas customizado"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gerar Relatório com MAESTRO</span>
          </Button>

          {/* Botão Gerar PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPdfDialogOpen(true)}
            disabled={loading || error || isEmpty}
            className="h-8 gap-1.5 text-xs border-border/70 hover:border-primary/40 bg-card/60"
            title="Opções de relatório e impressão em PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-primary" />
            <span>Gerar PDF</span>
          </Button>

          {/* Botão Atualizar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading || isRefreshing}
            className="h-8 gap-1.5 text-xs border-border/70 hover:border-primary/40 bg-card/60"
            title="Atualizar dados"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', (loading || isRefreshing) && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Banner de Erro caso falhe a atualização mantendo dados anteriores */}
      {error && <SyncErrorBanner message="Falha ao atualizar os dados." onRetry={loadData} />}

      {/* 1. ESTADO DE LOADING (Primeira carga sem dados) */}
      {loading && !data && <LoadingState />}

      {/* 2. ESTADO DE ERRO TOTAL (quando nem há dados anteriores) */}
      {!loading && error && !data && (
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
                Ocorreu uma falha na comunicação com o servidor ao consultar as informações de
                vendas.
              </p>
            </div>
            <Button onClick={() => void loadData()} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 3. ESTADO VAZIO */}
      {!loading && !error && isEmpty && (
        <Card className="glass-card border-dashed border-border/50 shadow-card">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Inbox className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-semibold text-lg text-foreground">Sem dados no momento</h3>
              <p className="text-sm text-muted-foreground">
                Não há informações de vendas para exibir no período selecionado (
                {data?.periodo || `${selectedYear}-${selectedMonth}`}).
              </p>
            </div>
            <Button onClick={loadData} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. ESTADO DE SUCESSO */}
      {!isEmpty && data && (
        <div className="space-y-8 animate-fade-in">
          {/* 1. Summary Cards no topo: total revenue, number of orders, average ticket e number of active clients */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Revenue */}
            <Card className="glass-card hover-lift border-l-4 border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Faturamento Total
                  </span>
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(faturadoBrl)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                    {variacaoPercent !== null ? (
                      <>
                        {variacaoPercent > 0 ? (
                          <span className="inline-flex items-center font-semibold text-emerald-500">
                            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />+
                            {formatPercentBR(variacaoPercent)}
                          </span>
                        ) : variacaoPercent < 0 ? (
                          <span className="inline-flex items-center font-semibold text-destructive">
                            <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                            {formatPercentBR(variacaoPercent)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center font-semibold text-muted-foreground">
                            <Minus className="w-3.5 h-3.5 mr-0.5" />
                            0,0%
                          </span>
                        )}
                        <span className="text-muted-foreground">vs anterior</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Comparação: —</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Number of Orders */}
            <Card className="glass-card hover-lift border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pedidos Faturados
                  </span>
                  <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-foreground">{qtdNotas}</div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Notas emitidas no período</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Average Ticket */}
            <Card className="glass-card hover-lift border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ticket Médio
                  </span>
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-foreground">
                    {ticketMedio !== null ? formatCurrency(ticketMedio) : '—'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                    <span>Média por pedido emitido</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Number of Active Clients */}
            <Card className="glass-card hover-lift border-l-4 border-l-sky-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Clientes Ativos
                  </span>
                  <div className="w-8 h-8 rounded-md bg-sky-500/10 flex items-center justify-center text-sky-500">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-foreground">
                    {clientesAtivos !== null ? clientesAtivos : '—'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                    <span>Com compras registradas no período</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 2 & 3. Tabelas Top 10 Clientes e Top Famílias */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela Top 10 Clientes */}
            <Card className="glass-card shadow-card">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" /> Top 10 Clientes
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Classificação ordenada pelo maior faturamento no período
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                    {top10Clientes.length} cliente{top10Clientes.length === 1 ? '' : 's'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop view (table) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="w-12 text-center text-xs">#</TableHead>
                        <TableHead className="text-xs font-semibold">Cliente</TableHead>
                        <TableHead className="text-center text-xs font-semibold">
                          Qtd. Pedidos
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                          Faturamento Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedClients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhum cliente com faturamento registrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedClients.map((item, idx) => {
                          const globalIdx = (clientsPage - 1) * ROWS_PER_PAGE + idx + 1
                          return (
                            <TableRow
                              key={`${item.cliente}-${idx}`}
                              className="border-border/20 hover:bg-muted/30 transition-colors"
                            >
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {globalIdx}
                              </TableCell>
                              <TableCell className="font-medium text-xs text-foreground">
                                {item.cliente || 'Outros'}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                —
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                                {formatCurrency(item.valor_brl)}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile view (< 768px): Card format */}
                <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
                  {paginatedClients.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Nenhum cliente com faturamento registrado.
                    </div>
                  ) : (
                    paginatedClients.map((item, idx) => {
                      const globalIdx = (clientsPage - 1) * ROWS_PER_PAGE + idx + 1
                      return (
                        <div
                          key={`mobile-${item.cliente}-${idx}`}
                          className="pt-3 first:pt-0 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                                {globalIdx}
                              </span>
                              <span className="font-semibold text-xs text-foreground">
                                {item.cliente || 'Outros'}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-primary shrink-0">
                              {formatCurrency(item.valor_brl)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-7">
                            <span>Qtd. Pedidos:</span>
                            <span className="font-mono">—</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Paginação */}
                {totalClientsPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-border/30 text-xs text-muted-foreground">
                    <span>
                      Página {clientsPage} de {totalClientsPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={clientsPage <= 1}
                        onClick={() => setClientsPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={clientsPage >= totalClientsPages}
                        onClick={() => setClientsPage((p) => Math.min(totalClientsPages, p + 1))}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela Top Famílias de Produtos */}
            <Card className="glass-card shadow-card">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" /> Top Famílias de Produtos
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Classificação ordenada pelo faturamento de cada família
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                    {topFamilias.length} famíl.{topFamilias.length === 1 ? '' : 's'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop view (table) */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="w-12 text-center text-xs">#</TableHead>
                        <TableHead className="text-xs font-semibold">Família</TableHead>
                        <TableHead className="text-center text-xs font-semibold">
                          Qtd. Vendida
                        </TableHead>
                        <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                          Faturamento Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedFamilies.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhuma família com faturamento registrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedFamilies.map((item, idx) => {
                          const globalIdx = (familiesPage - 1) * ROWS_PER_PAGE + idx + 1
                          return (
                            <TableRow
                              key={`${item.familia}-${idx}`}
                              className="border-border/20 hover:bg-muted/30 transition-colors"
                            >
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {globalIdx}
                              </TableCell>
                              <TableCell className="font-medium text-xs text-foreground">
                                {familiaCompleta('', item.familia)}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                —
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                                {formatCurrency(item.valor_brl)}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile view (< 768px): Card format */}
                <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
                  {paginatedFamilies.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Nenhuma família com faturamento registrado.
                    </div>
                  ) : (
                    paginatedFamilies.map((item, idx) => {
                      const globalIdx = (familiesPage - 1) * ROWS_PER_PAGE + idx + 1
                      return (
                        <div
                          key={`mobile-fam-${item.familia}-${idx}`}
                          className="pt-3 first:pt-0 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                                {globalIdx}
                              </span>
                              <span className="font-semibold text-xs text-foreground">
                                {familiaCompleta('', item.familia)}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-primary shrink-0">
                              {formatCurrency(item.valor_brl)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pl-7">
                            <span>Qtd. Vendida:</span>
                            <span className="font-mono">—</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Paginação */}
                {totalFamiliesPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-border/30 text-xs text-muted-foreground">
                    <span>
                      Página {familiesPage} de {totalFamiliesPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={familiesPage <= 1}
                        onClick={() => setFamiliesPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={familiesPage >= totalFamiliesPages}
                        onClick={() => setFamiliesPage((p) => Math.min(totalFamiliesPages, p + 1))}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 4. Seção Cobertura de Carteira */}
          <Card className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Cobertura de Carteira
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Acompanhamento mensal da carteira de pedidos (backlog) vs realizado e percentual
                    de cobertura
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-destructive inline-block" /> &lt;50%
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 50–80%
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> &gt;80%
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop view (table) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Mês</TableHead>
                      <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                        Valor em Carteira (Backlog)
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                        Valor Realizado (Faturado)
                      </TableHead>
                      <TableHead className="text-right text-xs font-semibold whitespace-nowrap">
                        Cobertura
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverageData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Sem dados de cobertura disponíveis.
                        </TableCell>
                      </TableRow>
                    ) : (
                      coverageData.map((row) => (
                        <TableRow
                          key={`${row.ano}-${row.mes}`}
                          className="border-border/20 hover:bg-muted/30 transition-colors"
                        >
                          <TableCell className="font-semibold text-xs text-foreground">
                            {row.label}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {row.carteiraBrl !== null ? formatCurrency(row.carteiraBrl) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                            {formatCurrency(row.faturadoBrl)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <CoverageBadge percent={row.coberturaPercent} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile view (< 768px): Card format */}
              <div className="md:hidden divide-y divide-border/30 p-3 space-y-3">
                {coverageData.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Sem dados de cobertura disponíveis.
                  </div>
                ) : (
                  coverageData.map((row) => (
                    <div
                      key={`mob-cov-${row.ano}-${row.mes}`}
                      className="pt-3 first:pt-0 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">{row.label}</span>
                        <CoverageBadge percent={row.coberturaPercent} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-muted-foreground block">Carteira (Backlog):</span>
                          <span className="font-mono font-medium text-foreground">
                            {row.carteiraBrl !== null ? formatCurrency(row.carteiraBrl) : '—'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground block">Realizado:</span>
                          <span className="font-mono font-semibold text-primary">
                            {formatCurrency(row.faturadoBrl)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Painel Estilo Chat do Assistente MAESTRO */}
      <MaestroChatPanel
        open={maestroPanelOpen}
        onOpenChange={setMaestroPanelOpen}
        initialPeriodInfo={{
          mode,
          ano: selectedYear,
          mes: mode === 'month' ? selectedMonth : undefined,
          semana: mode === 'week' ? selectedWeek : undefined,
        }}
      />

      {/* Modal de Opções para Gerar PDF */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Printer className="w-5 h-5 text-primary" /> Gerar Relatório em PDF
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Selecione quais seções deseja incluir no relatório de Resumo de Vendas para o período{' '}
              <strong className="text-foreground">
                {data?.periodo || `${selectedYear}-${selectedMonth}`}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="includeCards"
                  checked={pdfOptions.includeCards}
                  onCheckedChange={(checked) =>
                    setPdfOptions((prev) => ({ ...prev, includeCards: checked === true }))
                  }
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="includeCards" className="text-sm font-semibold cursor-pointer">
                    Cards de resumo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Faturamento total, pedidos faturados, ticket médio e clientes ativos.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="includeTopClientes"
                  checked={pdfOptions.includeTopClientes}
                  onCheckedChange={(checked) =>
                    setPdfOptions((prev) => ({ ...prev, includeTopClientes: checked === true }))
                  }
                />
                <div className="grid gap-1 leading-none">
                  <Label
                    htmlFor="includeTopClientes"
                    className="text-sm font-semibold cursor-pointer"
                  >
                    Top 10 Clientes
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Lista dos clientes com maior receita no período.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="includeTopFamilias"
                  checked={pdfOptions.includeTopFamilias}
                  onCheckedChange={(checked) =>
                    setPdfOptions((prev) => ({ ...prev, includeTopFamilias: checked === true }))
                  }
                />
                <div className="grid gap-1 leading-none">
                  <Label
                    htmlFor="includeTopFamilias"
                    className="text-sm font-semibold cursor-pointer"
                  >
                    Top Famílias de Produtos
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Faturamento distribuído por família de produto.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="includeCobertura"
                  checked={pdfOptions.includeCobertura}
                  onCheckedChange={(checked) =>
                    setPdfOptions((prev) => ({ ...prev, includeCobertura: checked === true }))
                  }
                />
                <div className="grid gap-1 leading-none">
                  <Label
                    htmlFor="includeCobertura"
                    className="text-sm font-semibold cursor-pointer"
                  >
                    Cobertura de Carteira
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Histórico de 6 meses de backlog vs faturamento realizado com badges.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md">
              <CalendarDays className="w-4 h-4 text-primary shrink-0" />
              <span>
                O documento será gerado com cabeçalho formal, data e valores no padrão brasileiro
                (R$).
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPdfDialogOpen(false)}
              disabled={isExportingPdf}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleGeneratePdf}
              disabled={isExportingPdf}
              className="gap-2"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExportingPdf ? 'Gerando...' : 'Gerar PDF'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CoverageBadge({ percent }: { percent: number | null }) {
  if (percent === null || percent === undefined || isNaN(percent)) {
    return (
      <Badge variant="outline" className="text-muted-foreground font-mono text-[11px] font-medium">
        —
      </Badge>
    )
  }

  const formatted = `${percent.toFixed(1).replace('.', ',')}%`

  if (percent < 50) {
    return (
      <Badge
        className={cn(
          'bg-destructive/15 text-destructive border-destructive/40 font-mono text-[11px] font-semibold hover:bg-destructive/20',
        )}
      >
        {formatted}
      </Badge>
    )
  }

  if (percent <= 80) {
    return (
      <Badge
        className={cn(
          'bg-amber-500/15 text-amber-500 border-amber-500/40 font-mono text-[11px] font-semibold hover:bg-amber-500/20',
        )}
      >
        {formatted}
      </Badge>
    )
  }

  return (
    <Badge
      className={cn(
        'bg-emerald-500/15 text-emerald-500 border-emerald-500/40 font-mono text-[11px] font-semibold hover:bg-emerald-500/20',
      )}
    >
      {formatted}
    </Badge>
  )
}

function LoadingState() {
  return (
    <div className="space-y-8 animate-shimmer">
      {/* 4 Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="glass-card shadow-card">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3.5 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2 Tables Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56 mt-1" />
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coverage Section Skeleton */}
      <Card className="glass-card shadow-card">
        <CardHeader className="pb-3 border-b border-border/30">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-72 mt-1" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
