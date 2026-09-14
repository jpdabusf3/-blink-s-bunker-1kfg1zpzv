import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  FileText,
  DollarSign,
  PieChart,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
  RefreshCw,
  ChevronDown,
  Inbox,
  AlertCircle,
  FileX,
} from 'lucide-react'
import { formatCurrency, formatCurrencyUSD } from '@/lib/utils'
import { toast } from 'sonner'
import {
  fetchResumoVendas,
  type ResumoVendasResponse,
  type ResumoVendasParams,
} from '@/services/resumo-vendas'
import { familiaCompleta } from '@/constants/familiaProdutos'

type PeriodKey = 'week_current' | 'month_current' | 'month_previous'

interface PeriodOption {
  key: PeriodKey
  label: string
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'week_current', label: 'Semana atual' },
  { key: 'month_current', label: 'Mês atual' },
  { key: 'month_previous', label: 'Mês anterior' },
]

export function ResumoVendasTab() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('month_current')
  const [loading, setLoading] = useState<boolean>(true)
  const [data, setData] = useState<ResumoVendasResponse | null>(null)
  const [is404, setIs404] = useState<boolean>(false)
  const [isEspecieOpen, setIsEspecieOpen] = useState<boolean>(false)

  const loadData = useCallback(async (period: PeriodKey) => {
    setLoading(true)
    setIs404(false)

    let params: ResumoVendasParams
    if (period === 'week_current') {
      params = { mode: 'week' }
    } else if (period === 'month_current') {
      params = { mode: 'month' }
    } else {
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1 // 1-12
      let targetYear = currentYear
      let targetMonth = currentMonth - 1
      if (targetMonth < 1) {
        targetMonth = 12
        targetYear = currentYear - 1
      }
      params = { mode: 'month', ano: targetYear, mes: targetMonth }
    }

    try {
      const res = await fetchResumoVendas(params)
      setData(res)
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : undefined

      if (status === 404) {
        setIs404(true)
      } else {
        toast.error('Erro ao carregar resumo.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedPeriod)
  }, [selectedPeriod, loadData])

  const handleRetry = () => {
    loadData(selectedPeriod)
  }

  // 1. Caso de endpoint 404 (não publicado)
  if (!loading && is404) {
    return (
      <div className="space-y-6">
        <PeriodSelector
          selectedPeriod={selectedPeriod}
          onSelect={setSelectedPeriod}
          periodoLabel={data?.periodo}
          disabled={loading}
        />
        <Card className="shadow-subtle border-dashed">
          <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="font-semibold text-base text-foreground">Resumo indisponível</h3>
              <p className="text-sm text-muted-foreground">
                Verifique se o hook resumo_vendas está publicado.
              </p>
            </div>
            <Button onClick={handleRetry} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const faturadoBrl = data?.faturado_total_brl ?? 0
  const faturadoUsd = data?.faturado_total_usd ?? 0
  const carteiraBrl = data?.carteira_total_brl ?? null
  const coberturaPercent = data?.cobertura_percent
  const variacaoPercent =
    data?.variacao_vs_anterior_percent ?? data?.variacao_semana_anterior ?? null
  const qtdNotas = data?.quantidade_notas ?? 0
  const metaBrl = data?.meta_brl ?? 0
  const metaAtingidaPercent = data?.meta_atingida_percent

  const topClientes = (data?.por_cliente ?? []).slice(0, 10)
  const porFamilia = data?.por_familia ?? []
  const porEspecie = data?.por_especie ?? []

  const isTotalEmpty =
    !loading &&
    data !== null &&
    faturadoBrl === 0 &&
    topClientes.length === 0 &&
    porFamilia.length === 0

  return (
    <div className="space-y-6">
      {/* Seletor de Período via Chips */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Seletor de Período
              </CardTitle>
              <CardDescription>
                Resumo analítico de vendas e faturamento consolidado
              </CardDescription>
            </div>
            {data?.periodo && (
              <div className="text-xs font-mono bg-primary/10 text-primary px-3 py-1.5 rounded-full font-semibold self-start sm:self-auto">
                Período: {data.periodo}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => {
              const active = selectedPeriod === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedPeriod(opt.key)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all border ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
            <span>Período resolvido retornado pela API:</span>
            <span className="font-mono font-medium text-foreground">
              {data?.periodo ? data.periodo : loading ? 'Carregando...' : '—'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {loading ? (
        <LoadingSkeleton />
      ) : isTotalEmpty ? (
        /* Empty State Global */
        <Card className="shadow-subtle border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileX className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="font-semibold text-lg text-foreground">
                Nenhum faturamento no período selecionado.
              </h3>
              <p className="text-sm text-muted-foreground">
                Não há registros de notas fiscais ou vendas computadas para este intervalo.
              </p>
            </div>
            <Button onClick={handleRetry} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Recarregar
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Success Content */
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards: 5 cards principais + Meta do Período (preservado) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. Faturado (BRL) */}
            <Card className="shadow-subtle border-l-4 border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Faturado (BRL)
                  </p>
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {formatCurrency(faturadoBrl)}
                </p>
                {faturadoUsd > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {formatCurrencyUSD(faturadoUsd)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 2. Carteira (BRL) */}
            <Card className="shadow-subtle border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Carteira (BRL)
                  </p>
                  <PieChart className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {carteiraBrl !== null && carteiraBrl !== undefined
                    ? formatCurrency(carteiraBrl)
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Pedidos em carteira</p>
              </CardContent>
            </Card>

            {/* 3. Cobertura */}
            <Card className="shadow-subtle border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cobertura
                  </p>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {coberturaPercent !== null && coberturaPercent !== undefined
                    ? `${coberturaPercent.toFixed(1).replace('.', ',')}%`
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Faturado vs Carteira</p>
              </CardContent>
            </Card>

            {/* 4. Variação vs anterior */}
            <Card className="shadow-subtle border-l-4 border-l-indigo-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Variação vs anterior
                  </p>
                  {variacaoPercent !== null && variacaoPercent !== undefined ? (
                    variacaoPercent > 0 ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : variacaoPercent < 0 ? (
                      <ArrowDownRight className="w-4 h-4 text-destructive" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground" />
                    )
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="mt-2">
                  {variacaoPercent !== null && variacaoPercent !== undefined ? (
                    <p
                      className={`text-2xl font-bold ${
                        variacaoPercent > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : variacaoPercent < 0
                            ? 'text-destructive'
                            : 'text-foreground'
                      }`}
                    >
                      {variacaoPercent > 0
                        ? `+${variacaoPercent.toFixed(1).replace('.', ',')}%`
                        : `${variacaoPercent.toFixed(1).replace('.', ',')}%`}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground">—</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Comparado ao período anterior</p>
              </CardContent>
            </Card>

            {/* 5. Qtd notas */}
            <Card className="shadow-subtle border-l-4 border-l-blue-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Qtd notas
                  </p>
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{qtdNotas}</p>
                <p className="text-xs text-muted-foreground mt-1">Documentos emitidos</p>
              </CardContent>
            </Card>

            {/* Card Preservado: Meta do Período */}
            <Card className="shadow-subtle border-l-4 border-l-purple-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Meta do Período
                  </p>
                  <Target className="w-4 h-4 text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {metaBrl > 0 ? formatCurrency(metaBrl) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metaAtingidaPercent !== null && metaAtingidaPercent !== undefined ? (
                    <span
                      className={
                        metaAtingidaPercent >= 100
                          ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                          : 'font-semibold text-purple-600 dark:text-purple-400'
                      }
                    >
                      {metaAtingidaPercent.toFixed(1).replace('.', ',')}% da meta atingida
                    </span>
                  ) : (
                    'Sem meta cadastrada'
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabelas de Detalhamento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela Faturado por Cliente (Top 10) */}
            <Card className="shadow-subtle">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> Faturado por Cliente (Top 10)
                </CardTitle>
                <CardDescription>Maiores faturamentos no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Valor (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topClientes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                            <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                              <Inbox className="w-5 h-5 text-muted-foreground/60" />
                              <span className="text-xs">Nenhum registro no período.</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        topClientes.map((cli, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium text-xs">{cli.cliente}</TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                              {formatCurrency(cli.valor_brl)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Tabela Faturado por Família */}
            <Card className="shadow-subtle">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" /> Faturado por Família
                </CardTitle>
                <CardDescription>Distribuição de vendas por família de produtos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Família</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Valor (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porFamilia.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                            <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                              <Inbox className="w-5 h-5 text-muted-foreground/60" />
                              <span className="text-xs">Nenhum registro no período.</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        porFamilia.map((fam, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium text-xs">
                              {familiaCompleta('', fam.familia)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                              {formatCurrency(fam.valor_brl)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seção Opcional Colapsável: Faturado por Espécie */}
          <Collapsible open={isEspecieOpen} onOpenChange={setIsEspecieOpen}>
            <Card className="shadow-subtle">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" /> Faturado por Espécie
                    </CardTitle>
                    <CardDescription>Distribuição de vendas por espécie animal</CardDescription>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 text-xs">
                      <span>{isEspecieOpen ? 'Recolher' : 'Expandir'}</span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isEspecieOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>Espécie</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Valor (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {porEspecie.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center text-muted-foreground h-24"
                            >
                              <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                                <Inbox className="w-5 h-5 text-muted-foreground/60" />
                                <span className="text-xs">Nenhum registro no período.</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          porEspecie.map((esp, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="font-medium text-xs">{esp.especie}</TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-primary whitespace-nowrap">
                                {formatCurrency(esp.valor_brl)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      )}
    </div>
  )
}

interface PeriodSelectorProps {
  selectedPeriod: PeriodKey
  onSelect: (p: PeriodKey) => void
  periodoLabel?: string
  disabled?: boolean
}

function PeriodSelector({ selectedPeriod, onSelect, periodoLabel, disabled }: PeriodSelectorProps) {
  return (
    <Card className="shadow-subtle">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Seletor de Período
            </CardTitle>
            <CardDescription>Resumo analítico de vendas e faturamento consolidado</CardDescription>
          </div>
          {periodoLabel && (
            <div className="text-xs font-mono bg-primary/10 text-primary px-3 py-1.5 rounded-full font-semibold self-start sm:self-auto">
              Período: {periodoLabel}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => {
            const active = selectedPeriod === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(opt.key)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all border ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
          <span>Período resolvido retornado pela API:</span>
          <span className="font-mono font-medium text-foreground">{periodoLabel || '—'}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* 5 Cards + Meta Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="shadow-subtle">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </div>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Duas Tabelas Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-subtle">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56 mt-1" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56 mt-1" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
