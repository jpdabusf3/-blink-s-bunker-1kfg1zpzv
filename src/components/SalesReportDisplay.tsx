import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { formatPercentBR, formatDataBR } from '@/lib/corporateDocuments'
import {
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  Layers,
  MapPin,
  Calendar,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import {
  type GeneratedSalesReportData,
  exportSalesReportToCSV,
  exportSalesReportToPDF,
} from '@/services/sales-report-generator'

interface SalesReportDisplayProps {
  report: GeneratedSalesReportData
}

const PIE_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#0284c7',
  '#d97706',
  '#16a34a',
  '#9333ea',
  '#ec4899',
]

export function SalesReportDisplay({ report }: SalesReportDisplayProps) {
  const [activeTab, setActiveTab] = useState<
    'geral' | 'mes' | 'clientes' | 'produtos' | 'segmentos' | 'ufs'
  >('geral')

  const periodoLabel = `${formatDataBR(report.filtros.dataInicio || 'Início')} até ${formatDataBR(report.filtros.dataFim || 'Hoje')}`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra de Ações do Relatório Gerado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
            >
              Relatório Ativo
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Período: <strong className="text-foreground">{periodoLabel}</strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {report.totalRegistros} lançamentos processados · Gerado por {report.geradoPor}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSalesReportToCSV(report)}
            className="gap-2 flex-1 sm:flex-initial"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => exportSalesReportToPDF(report)}
            className="gap-2 flex-1 sm:flex-initial bg-primary text-primary-foreground shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-subtle border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Total Faturado no Período
              <DollarSign className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-extrabold text-foreground">
              {formatCurrency(report.totalFaturado)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Receita consolidada de faturamento</p>
          </CardContent>
        </Card>

        <Card className="shadow-subtle border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Lançamentos / Notas
              <Layers className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-extrabold text-foreground">
              {report.totalRegistros}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total de registros comercializados</p>
          </CardContent>
        </Card>

        <Card className="shadow-subtle border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Ticket Médio
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-extrabold text-foreground">
              {formatCurrency(report.ticketMedio)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Média por operação faturada</p>
          </CardContent>
        </Card>

        <Card className="shadow-subtle border-l-4 border-l-sky-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              Top 10 Clientes (Share)
              <Users className="w-4 h-4 text-sky-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-extrabold text-foreground">
              {formatPercentBR(
                report.topClientes.reduce((acc, c) => acc + c.participacaoPercent, 0),
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {report.topClientes.length} maiores compradores
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Visão Geral (stack em mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Mês a Mês */}
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Evolução do Faturamento Mês a Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {report.mesAMes.length > 0 ? (
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.mesAMes}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      tickFormatter={(v) => `R$ ${Math.round(v / 1000)}k`}
                      tick={{ fontSize: 11 }}
                      width={65}
                    />
                    <Tooltip
                      formatter={(val: number) => [formatCurrency(val), 'Faturamento']}
                      labelFormatter={(l) => `Mês: ${l}`}
                    />
                    <Bar
                      dataKey="totalFaturado"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name="Faturamento (R$)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico Distribuição por Segmento */}
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Faturamento por Segmento
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {report.distribuicaoSegmento.length > 0 ? (
              <ChartContainer config={{}} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.distribuicaoSegmento}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="totalFaturado"
                      nameKey="nome"
                    >
                      {report.distribuicaoSegmento.map((_, idx) => (
                        <Cell key={`seg-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção 1: Comparativo Mês a Mês (Tabela desktop / Cards mobile) */}
      <Card className="shadow-subtle">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">Comparativo Mês a Mês</CardTitle>
              <p className="text-xs text-muted-foreground">
                Progressão cronológica de faturamento, pedidos e ticket médio
              </p>
            </div>
            <Badge variant="outline">{report.mesAMes.length} mês(es)</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {report.mesAMes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum dado mensal no período selecionado.
            </div>
          ) : (
            <>
              {/* Desktop Table (hidden below 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês de Referência</TableHead>
                      <TableHead className="text-center">Qtd Notas/Pedidos</TableHead>
                      <TableHead className="text-right">Ticket Médio (R$)</TableHead>
                      <TableHead className="text-right">Variação (%)</TableHead>
                      <TableHead className="text-right">Total Faturado (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.mesAMes.map((item) => (
                      <TableRow key={item.anoMes}>
                        <TableCell className="font-semibold text-foreground">
                          {item.label}
                        </TableCell>
                        <TableCell className="text-center">{item.totalNotas}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.ticketMedio)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.variacaoAnteriorPercent !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                item.variacaoAnteriorPercent >= 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {item.variacaoAnteriorPercent >= 0 ? (
                                <TrendingUp className="w-3.5 h-3.5 inline" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 inline" />
                              )}
                              {item.variacaoAnteriorPercent >= 0 ? '+' : ''}
                              {formatPercentBR(item.variacaoAnteriorPercent)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary font-mono">
                          {formatCurrency(item.totalFaturado)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards (visible below 768px) */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {report.mesAMes.map((item) => (
                  <div
                    key={item.anoMes}
                    className="p-3.5 rounded-lg border bg-muted/20 space-y-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{item.label}</span>
                      <span className="font-mono font-bold text-primary">
                        {formatCurrency(item.totalFaturado)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t text-muted-foreground">
                      <div>
                        <span className="block text-[10px] uppercase font-medium">Notas</span>
                        <span className="font-semibold text-foreground">{item.totalNotas}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-medium">
                          Ticket Médio
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatCurrency(item.ticketMedio)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] uppercase font-medium">Variação</span>
                        {item.variacaoAnteriorPercent !== null ? (
                          <span
                            className={`font-semibold ${
                              item.variacaoAnteriorPercent >= 0
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {item.variacaoAnteriorPercent >= 0 ? '+' : ''}
                            {formatPercentBR(item.variacaoAnteriorPercent)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Top 10 Clientes (Tabela desktop / Cards mobile) */}
      <Card className="shadow-subtle">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Top 10 Clientes por Faturamento
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Clientes com maior representatividade no faturamento do período
              </p>
            </div>
            <Badge variant="outline">Top 10</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {report.topClientes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum cliente registrado no período.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Posição</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-20 text-center">UF</TableHead>
                      <TableHead className="w-32">Segmento</TableHead>
                      <TableHead className="text-right w-36">Participação (%)</TableHead>
                      <TableHead className="text-right w-44">Total Faturado (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.topClientes.map((c) => (
                      <TableRow key={c.posicao}>
                        <TableCell className="text-center font-bold text-muted-foreground">
                          {c.posicao}º
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{c.nome}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-[11px] font-mono">
                            {c.uf || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.segmento || '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatPercentBR(c.participacaoPercent)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary font-mono">
                          {formatCurrency(c.totalFaturado)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {report.topClientes.map((c) => (
                  <div
                    key={c.posicao}
                    className="p-3.5 rounded-lg border bg-muted/20 space-y-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {c.posicao}º
                        </span>
                        <span className="font-bold text-foreground leading-snug">{c.nome}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0 font-mono">
                        {c.uf || '—'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">
                        {c.segmento || 'Segmento N/I'} · {formatPercentBR(c.participacaoPercent)}{' '}
                        share
                      </span>
                      <span className="font-bold text-primary font-mono">
                        {formatCurrency(c.totalFaturado)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Seção 3: Top 10 Produtos / Famílias (Tabela desktop / Cards mobile) */}
      <Card className="shadow-subtle">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Top 10 Produtos e Famílias
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Produtos com maior retorno financeiro no período analisado
              </p>
            </div>
            <Badge variant="outline">Top 10 Produtos</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {report.topProdutos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nenhum produto registrado no período.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Posição</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="w-48">Família</TableHead>
                      <TableHead className="text-right w-36">Participação (%)</TableHead>
                      <TableHead className="text-right w-44">Total Faturado (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.topProdutos.map((p) => (
                      <TableRow key={p.posicao}>
                        <TableCell className="text-center font-bold text-muted-foreground">
                          {p.posicao}º
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{p.nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {p.familia}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatPercentBR(p.participacaoPercent)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary font-mono">
                          {formatCurrency(p.totalFaturado)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {report.topProdutos.map((p) => (
                  <div
                    key={p.posicao}
                    className="p-3.5 rounded-lg border bg-muted/20 space-y-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {p.posicao}º
                        </span>
                        <span className="font-bold text-foreground leading-snug">{p.nome}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {p.familia}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t">
                      <span className="text-muted-foreground">
                        {formatPercentBR(p.participacaoPercent)} share
                      </span>
                      <span className="font-bold text-primary font-mono">
                        {formatCurrency(p.totalFaturado)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Seção 4: Distribuição por Segmento e Distribuição por UF (Lado a Lado / Stack mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Segmento */}
        <Card className="shadow-subtle">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Distribuição por Segmento
              </CardTitle>
              <Badge variant="outline">{report.distribuicaoSegmento.length} segmentos</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {report.distribuicaoSegmento.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Sem dados por segmento.
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segmento</TableHead>
                        <TableHead className="text-center w-24">Lançamentos</TableHead>
                        <TableHead className="text-right w-28">Part. (%)</TableHead>
                        <TableHead className="text-right w-36">Faturamento (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.distribuicaoSegmento.map((s) => (
                        <TableRow key={s.nome}>
                          <TableCell className="font-semibold text-foreground">{s.nome}</TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {s.quantidade}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatPercentBR(s.participacaoPercent)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary font-mono">
                            {formatCurrency(s.totalFaturado)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="grid grid-cols-1 gap-2.5 md:hidden">
                  {report.distribuicaoSegmento.map((s) => (
                    <div
                      key={s.nome}
                      className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between text-sm"
                    >
                      <div>
                        <span className="font-bold text-foreground block">{s.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.quantidade} notas · {formatPercentBR(s.participacaoPercent)}
                        </span>
                      </div>
                      <span className="font-bold text-primary font-mono text-sm">
                        {formatCurrency(s.totalFaturado)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por UF */}
        <Card className="shadow-subtle">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Distribuição por Estado (UF)
              </CardTitle>
              <Badge variant="outline">{report.distribuicaoUf.length} UFs</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {report.distribuicaoUf.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Sem dados por UF.
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto max-h-[350px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">UF</TableHead>
                        <TableHead className="text-center w-24">Lançamentos</TableHead>
                        <TableHead className="text-right w-28">Part. (%)</TableHead>
                        <TableHead className="text-right w-36">Faturamento (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.distribuicaoUf.map((u) => (
                        <TableRow key={u.nome}>
                          <TableCell className="font-semibold text-foreground">
                            <Badge variant="secondary" className="font-mono">
                              {u.nome}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {u.quantidade}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatPercentBR(u.participacaoPercent)}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary font-mono">
                            {formatCurrency(u.totalFaturado)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="grid grid-cols-1 gap-2.5 md:hidden">
                  {report.distribuicaoUf.map((u) => (
                    <div
                      key={u.nome}
                      className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono">
                          {u.nome}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {u.quantidade} notas ({formatPercentBR(u.participacaoPercent)})
                        </span>
                      </div>
                      <span className="font-bold text-primary font-mono text-sm">
                        {formatCurrency(u.totalFaturado)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
