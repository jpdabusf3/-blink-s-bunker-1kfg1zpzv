import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  TrendingDown,
  FileText,
  DollarSign,
  PieChart,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
} from 'lucide-react'
import { formatCurrency, formatCurrencyUSD } from '@/lib/utils'
import { toast } from 'sonner'
import {
  fetchResumoVendas,
  type ResumoVendasResponse,
  type ResumoVendasParams,
} from '@/services/resumo-vendas'

function getIsoWeek(dateObj: Date): number {
  const d = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

export function ResumoVendasTab() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentWeek = getIsoWeek(now)

  // Opções de seletor rápido: 'current_week' | 'current_month' | 'custom_month' | 'custom_week'
  const [periodoTipo, setPeriodoTipo] = useState<
    'current_week' | 'current_month' | 'custom_month' | 'custom_week'
  >('current_month')
  const [ano, setAno] = useState<number>(currentYear)
  const [mes, setMes] = useState<number>(currentMonth)
  const [semana, setSemana] = useState<number>(currentWeek)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ResumoVendasResponse | null>(null)

  // Lista de anos para seleção
  const anosDisponiveis = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, 2025]
  const uniqueAnos = Array.from(new Set(anosDisponiveis)).sort((a, b) => b - a)

  // Lista de 1 a 53 para semanas
  const semanasDisponiveis = Array.from({ length: 53 }, (_, i) => i + 1)

  useEffect(() => {
    let active = true
    setLoading(true)

    let params: ResumoVendasParams
    if (periodoTipo === 'current_week') {
      params = { mode: 'week', ano: currentYear, semana: currentWeek }
    } else if (periodoTipo === 'current_month') {
      params = { mode: 'month', ano: currentYear, mes: currentMonth }
    } else if (periodoTipo === 'custom_week') {
      params = { mode: 'week', ano, semana }
    } else {
      params = { mode: 'month', ano, mes }
    }

    fetchResumoVendas(params)
      .then((res) => {
        if (active) {
          setData(res)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setLoading(false)
          toast.error('Erro ao carregar resumo.')
          console.error(err)
        }
      })

    return () => {
      active = false
    }
  }, [periodoTipo, ano, mes, semana, currentYear, currentMonth, currentWeek])

  const faturadoBrl = data?.faturado_total_brl ?? 0
  const faturadoUsd = data?.faturado_total_usd ?? 0
  const carteiraBrl = data?.carteira_total_brl
  const metaBrl = data?.meta_brl ?? 0
  const metaAtingidaPercent = data?.meta_atingida_percent
  const qtdNotas = data?.quantidade_notas ?? 0
  const variacao = data?.variacao_semana_anterior ?? 0

  // Cobertura (faturado/carteira %): usa o valor do backend se disponível, senão fallback client-side
  const coberturaVal =
    data?.cobertura_percent !== undefined
      ? data.cobertura_percent
      : carteiraBrl !== null && carteiraBrl !== undefined && carteiraBrl > 0
        ? Math.round((faturadoBrl / carteiraBrl) * 100 * 10) / 10
        : null

  const coberturaStr =
    coberturaVal !== null && coberturaVal !== undefined ? `${coberturaVal.toFixed(1)}%` : '—'

  return (
    <div className="space-y-6">
      {/* Seletor de Período */}
      <Card className="shadow-subtle">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Seletor de Período
              </CardTitle>
              <CardDescription>
                Resumo analítico extraído da base de faturamento 2025+ e carteira de pedidos
              </CardDescription>
            </div>
            {data?.periodo && (
              <div className="text-xs font-mono bg-primary/10 text-primary px-3 py-1.5 rounded-full font-semibold self-start sm:self-auto">
                Período: {data.periodo}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-auto min-w-[200px]">
              <Select
                value={periodoTipo}
                onValueChange={(val: any) => {
                  setPeriodoTipo(val)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_month">
                    Mês Atual ({MESES.find((m) => m.value === currentMonth)?.label} {currentYear})
                  </SelectItem>
                  <SelectItem value="current_week">Semana Atual (Semana {currentWeek})</SelectItem>
                  <SelectItem value="custom_month">Mês Específico (Ano + Mês)</SelectItem>
                  <SelectItem value="custom_week">Semana Específica (Ano + Semana)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(periodoTipo === 'custom_month' || periodoTipo === 'custom_week') && (
              <div className="flex items-center gap-2">
                <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v, 10))}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueAnos.map((a) => (
                      <SelectItem key={a} value={String(a)}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {periodoTipo === 'custom_month' && (
              <div className="flex items-center gap-2">
                <Select value={String(mes)} onValueChange={(v) => setMes(parseInt(v, 10))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {periodoTipo === 'custom_week' && (
              <div className="flex items-center gap-2">
                <Select value={String(semana)} onValueChange={(v) => setSemana(parseInt(v, 10))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Semana" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {semanasDisponiveis.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        Semana {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skeletons ou Cards */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="shadow-subtle">
                <CardContent className="p-5 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-subtle">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
            <Card className="shadow-subtle">
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Métricas Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Card Faturado BRL */}
            <Card className="shadow-subtle border-l-4 border-l-primary">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Faturado BRL</p>
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

            {/* Card Meta e % Atingido */}
            <Card className="shadow-subtle border-l-4 border-l-purple-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Meta do Período</p>
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
                      {metaAtingidaPercent.toFixed(1)}% da meta atingida
                    </span>
                  ) : (
                    'Sem meta cadastrada'
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Card Carteira BRL */}
            <Card className="shadow-subtle border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Carteira BRL</p>
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

            {/* Card Cobertura */}
            <Card className="shadow-subtle border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Cobertura</p>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{coberturaStr}</p>
                <p className="text-xs text-muted-foreground mt-1">Faturado vs Carteira</p>
              </CardContent>
            </Card>

            {/* Card Quantidade Notas */}
            <Card className="shadow-subtle border-l-4 border-l-blue-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Qtd Notas / Docs</p>
                  <FileText className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">{qtdNotas}</p>
                <p className="text-xs text-muted-foreground mt-1">Documentos emitidos</p>
              </CardContent>
            </Card>

            {/* Card Variação */}
            <Card className="shadow-subtle border-l-4 border-l-indigo-500">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Variação vs Anterior</p>
                  {variacao > 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                  ) : variacao < 0 ? (
                    <ArrowDownRight className="w-4 h-4 text-destructive" />
                  ) : (
                    <Minus className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <p
                    className={`text-2xl font-bold ${
                      variacao > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : variacao < 0
                          ? 'text-destructive'
                          : 'text-foreground'
                    }`}
                  >
                    {variacao > 0 ? `+${variacao.toFixed(1)}%` : `${variacao.toFixed(1)}%`}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Comparado ao período anterior</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabelas de Detalhamento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Clientes */}
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
                        <TableHead className="text-right">Faturado (BRL)</TableHead>
                        <TableHead className="text-right w-20">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!data?.por_cliente || data.por_cliente.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground h-20">
                            Nenhum faturamento registrado no período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.por_cliente.map((cli, idx) => {
                          const pct =
                            faturadoBrl > 0
                              ? ((cli.valor_brl / faturadoBrl) * 100).toFixed(1)
                              : '0.0'
                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="font-medium text-xs">{cli.cliente}</TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-primary">
                                {formatCurrency(cli.valor_brl)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                {pct}%
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Faturado por Família */}
            <Card className="shadow-subtle">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" /> Faturado por Família de Produtos
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
                        <TableHead className="text-right">Faturado (BRL)</TableHead>
                        <TableHead className="text-right w-20">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!data?.por_familia || data.por_familia.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground h-20">
                            Nenhum registro por família no período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.por_familia.map((fam, idx) => {
                          const pct =
                            faturadoBrl > 0
                              ? ((fam.valor_brl / faturadoBrl) * 100).toFixed(1)
                              : '0.0'
                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="font-medium text-xs">{fam.familia}</TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-primary">
                                {formatCurrency(fam.valor_brl)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                {pct}%
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Opcional: Detalhamento por Espécie (se houver dados) */}
          {data?.por_especie && data.por_especie.length > 0 && (
            <Card className="shadow-subtle">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Faturado por Espécie
                </CardTitle>
                <CardDescription>Distribuição inferida por espécie animal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {data.por_especie.map((esp, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-muted/40 rounded-lg border border-border/50 flex flex-col justify-between"
                    >
                      <p className="text-xs font-medium text-muted-foreground truncate">
                        {esp.especie}
                      </p>
                      <p className="text-base font-bold text-primary mt-1">
                        {formatCurrency(esp.valor_brl)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
