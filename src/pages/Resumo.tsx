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
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import {
  fetchResumoVendas,
  type ResumoVendasResponse,
  type ResumoClienteItem,
  type ResumoFamiliaItem,
} from '@/services/resumo-vendas'
import { familiaCompleta } from '@/constants/familiaProdutos'

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

export default function Resumo() {
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)
  const [data, setData] = useState<ResumoVendasResponse | null>(null)
  const [coverageData, setCoverageData] = useState<MonthCoverageItem[]>([])
  const [clientsPage, setClientsPage] = useState<number>(1)
  const [familiesPage, setFamiliesPage] = useState<number>(1)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)

    try {
      // 1. Fetch do período padrão (mode='month' sem ano/mes -> mês corrente no servidor)
      const currentRes = await fetchResumoVendas({ mode: 'month' })
      setData(currentRes)

      // 2. Extrair ano e mês do período resolvido (ex: "2026-09") para buscar os últimos 6 meses
      let refYear = new Date().getFullYear()
      let refMonth = new Date().getMonth() + 1
      if (currentRes.periodo && currentRes.periodo.includes('-')) {
        const parts = currentRes.periodo.split('-')
        const py = parseInt(parts[0], 10)
        const pm = parseInt(parts[1], 10)
        if (!isNaN(py) && py > 0) refYear = py
        if (!isNaN(pm) && pm >= 1 && pm <= 12) refMonth = pm
      }

      // Gerar os últimos 6 meses em ordem cronológica
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

      // Chamadas paralelas para obter a cobertura de cada mês
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

      setCoverageData(coverageResults)
      setClientsPage(1)
      setFamiliesPage(1)
    } catch (err: unknown) {
      console.error('Erro ao carregar resumo de vendas:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // KPIs
  const faturadoBrl = data?.faturado_total_brl ?? 0
  const qtdNotas = data?.quantidade_notas ?? 0
  const ticketMedio = qtdNotas > 0 ? faturadoBrl / qtdNotas : null

  // Número de clientes ativos (distintos)
  const clientesAtivos = useMemo(() => {
    if (!data?.por_cliente) return null
    return data.por_cliente.length
  }, [data])

  // Variação vs período anterior (tolerar múltiplos nomes retornados pela API)
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> Resumo de Vendas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada de receita, volume de pedidos, ticket médio e cobertura de carteira
          </p>
        </div>

        {data?.periodo && !loading && !error && (
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
              <Calendar className="w-3.5 h-3.5" />
              <span>Período: {data.periodo}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="gap-2 text-xs border-border/60 hover:border-primary/40"
              title="Atualizar dados"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        )}
      </div>

      {/* 1. ESTADO DE LOADING */}
      {loading && <LoadingState />}

      {/* 2. ESTADO DE ERRO */}
      {!loading && error && (
        <Card className="glass-card border-destructive/30 shadow-card">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-semibold text-lg text-foreground">
                Nao foi possivel carregar o resumo.
              </h3>
              <p className="text-sm text-muted-foreground">
                Ocorreu uma falha na comunicação com o servidor ao consultar as informações de
                vendas.
              </p>
            </div>
            <Button onClick={loadData} variant="default" className="gap-2">
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
                Nao ha informacoes de vendas para exibir ainda.
              </p>
            </div>
            <Button onClick={loadData} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 4. ESTADO DE SUCESSO */}
      {!loading && !error && !isEmpty && data && (
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
