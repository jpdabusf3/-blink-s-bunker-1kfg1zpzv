import { useState } from 'react'
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
import {
  DollarSign,
  Receipt,
  Users,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  type RelatorioVendasCalculado,
  exportarRelatorioVendasExcel,
  exportarRelatorioVendasPDF,
} from '@/services/relatorio-vendas-service'
import { formatPercentBR } from '@/lib/corporateDocuments'

interface RelatorioVendasVisualizacaoProps {
  report: RelatorioVendasCalculado
}

export function RelatorioVendasVisualizacao({ report }: RelatorioVendasVisualizacaoProps) {
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const handleDownloadExcel = () => {
    try {
      setDownloadingExcel(true)
      exportarRelatorioVendasExcel(report)
    } catch (err) {
      console.error('Erro ao exportar Excel:', err)
    } finally {
      setDownloadingExcel(false)
    }
  }

  const handleDownloadPdf = () => {
    try {
      setDownloadingPdf(true)
      exportarRelatorioVendasPDF(report)
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  const formatarDataIsoHoraBR = (iso: string): string => {
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return iso
      const dia = String(d.getDate()).padStart(2, '0')
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const ano = d.getFullYear()
      const hora = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${dia}/${mes}/${ano} às ${hora}:${min}`
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra de Título do Relatório com Data de Geração e Ações de Exportação */}
      <Card className="glass-card border-primary/20 shadow-card">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold"
              >
                Relatório de Vendas
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" /> Gerado em{' '}
                {formatarDataIsoHoraBR(report.geradoEm)}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Período: {report.periodoLabel}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
              <span>
                <strong>Segmentos:</strong> {report.filtros.segmentos.join(', ')}
              </span>
              <span>•</span>
              <span>
                <strong>Vendedor:</strong>{' '}
                {report.filtros.vendedor !== 'all' ? report.filtros.vendedor : 'Todos'}
              </span>
              <span>•</span>
              <span>
                <strong>Estado:</strong>{' '}
                {report.filtros.estado !== 'all' ? report.filtros.estado : 'Todos'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="gap-1.5 text-xs h-9 border-border/70"
            >
              <FileText className="w-4 h-4 text-rose-500" />
              <span>Baixar PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
              className="gap-1.5 text-xs h-9 border-border/70"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Baixar Excel</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 1. SEÇÃO: Resumo Executivo */}
      {report.secoes.includes('resumo_executivo') && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Resumo Executivo</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Faturado */}
            <Card className="glass-card shadow-card border-l-4 border-l-primary">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Faturado
                  </span>
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono text-primary">
                  {formatCurrency(report.totalFaturado)}
                </div>
                <p className="text-[11px] text-muted-foreground">Receita comercial consolidada</p>
              </CardContent>
            </Card>

            {/* Card 2: Lançamentos / Notas */}
            <Card className="glass-card shadow-card border-l-4 border-l-amber-500">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Lançamentos / Notas
                  </span>
                  <Receipt className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {report.totalRegistros}
                </div>
                <p className="text-[11px] text-muted-foreground">Volume de notas no período</p>
              </CardContent>
            </Card>

            {/* Card 3: Ticket Médio */}
            <Card className="glass-card shadow-card border-l-4 border-l-emerald-500">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Ticket Médio
                  </span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(report.ticketMedio)}
                </div>
                <p className="text-[11px] text-muted-foreground">Média por lançamento</p>
              </CardContent>
            </Card>

            {/* Card 4: Clientes Ativos */}
            <Card className="glass-card shadow-card border-l-4 border-l-sky-500">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Clientes Ativos
                  </span>
                  <Users className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-foreground">
                  {report.totalClientesAtivos}
                </div>
                <p className="text-[11px] text-muted-foreground">Compras registradas</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 2. SEÇÃO: Vendas por Cliente */}
      {report.secoes.includes('vendas_por_cliente') && (
        <Card className="glass-card shadow-card">
          <CardHeader className="pb-3 border-b border-border/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Vendas por Cliente
                </CardTitle>
                <CardDescription className="text-xs">
                  {report.vendasPorCliente.length} clientes encontrados no período selecionado
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {report.vendasPorCliente.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum cliente com compras no período.
              </div>
            ) : (
              <>
                {/* Desktop table: hidden below 768px */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px] text-center">Posição</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="w-[70px] text-center">UF</TableHead>
                        <TableHead>Segmento</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center w-[80px]">Notas</TableHead>
                        <TableHead className="text-right">Participação</TableHead>
                        <TableHead className="text-right">Total Faturado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.vendasPorCliente.map((c) => (
                        <TableRow key={c.nome + c.posicao}>
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {c.posicao}º
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-foreground">
                            {c.nome}
                            {c.codigo && (
                              <span className="block text-[10px] text-muted-foreground font-mono">
                                {c.codigo}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {c.uf}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{c.segmento}</TableCell>
                          <TableCell className="text-xs">{c.vendedor}</TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            {c.qtdNotas}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {formatPercentBR(c.participacaoPercent)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold font-mono text-primary">
                            {formatCurrency(c.totalFaturado)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards view: visible below 768px */}
                <div className="md:hidden divide-y divide-border/40 p-3 space-y-3">
                  {report.vendasPorCliente.map((c) => (
                    <div key={c.nome + c.posicao} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              #{c.posicao}
                            </span>
                            <span className="text-xs font-bold text-foreground line-clamp-1">
                              {c.nome}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {c.uf}
                            </Badge>
                            <span>•</span>
                            <span>{c.segmento}</span>
                            <span>•</span>
                            <span>{c.vendedor}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold font-mono text-primary block">
                            {formatCurrency(c.totalFaturado)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatPercentBR(c.participacaoPercent)} ({c.qtdNotas} nfs)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. SEÇÃO: Vendas por Segmento e Vendas por Estado lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendas por Segmento */}
        {report.secoes.includes('vendas_por_segmento') && (
          <Card className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Vendas por Segmento
              </CardTitle>
              <CardDescription className="text-xs">
                Distribuição comercial por carteira atendida
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {report.vendasPorSegmento.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhum registro de segmento.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Segmento</TableHead>
                          <TableHead className="text-center w-[90px]">Qtd Notas</TableHead>
                          <TableHead className="text-right w-[110px]">Participação</TableHead>
                          <TableHead className="text-right">Total Faturado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.vendasPorSegmento.map((s) => (
                          <TableRow key={s.segmento}>
                            <TableCell className="font-semibold text-xs">{s.segmento}</TableCell>
                            <TableCell className="text-center text-xs font-mono">
                              {s.qtdNotas}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono">
                              {formatPercentBR(s.participacaoPercent)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold font-mono text-primary">
                              {formatCurrency(s.totalFaturado)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Cards mobile */}
                  <div className="md:hidden divide-y divide-border/40 p-3 space-y-2.5">
                    {report.vendasPorSegmento.map((s) => (
                      <div
                        key={s.segmento}
                        className="pt-2.5 first:pt-0 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-xs font-bold text-foreground block">
                            {s.segmento}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {s.qtdNotas} nota(s) emitida(s)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold font-mono text-primary block">
                            {formatCurrency(s.totalFaturado)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatPercentBR(s.participacaoPercent)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vendas por Estado */}
        {report.secoes.includes('vendas_por_estado') && (
          <Card className="glass-card shadow-card">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" /> Vendas por Estado
              </CardTitle>
              <CardDescription className="text-xs">
                Distribuição regional por Unidade da Federação (UF)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {report.vendasPorEstado.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhum registro de estado.
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Estado (UF)</TableHead>
                          <TableHead className="text-center w-[90px]">Qtd Notas</TableHead>
                          <TableHead className="text-right w-[110px]">Participação</TableHead>
                          <TableHead className="text-right">Total Faturado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.vendasPorEstado.map((e) => (
                          <TableRow key={e.estado}>
                            <TableCell className="font-semibold text-xs font-mono">
                              <Badge variant="outline" className="text-xs">
                                {e.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs font-mono">
                              {e.qtdNotas}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono">
                              {formatPercentBR(e.participacaoPercent)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-bold font-mono text-primary">
                              {formatCurrency(e.totalFaturado)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Cards mobile */}
                  <div className="md:hidden divide-y divide-border/40 p-3 space-y-2.5">
                    {report.vendasPorEstado.map((e) => (
                      <div
                        key={e.estado}
                        className="pt-2.5 first:pt-0 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {e.estado}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {e.qtdNotas} nota(s)
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold font-mono text-primary block">
                            {formatCurrency(e.totalFaturado)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatPercentBR(e.participacaoPercent)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 4. SEÇÃO: Evolução Mensal */}
      {report.secoes.includes('evolucao_mensal') && (
        <Card className="glass-card shadow-card">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Evolução Mensal
            </CardTitle>
            <CardDescription className="text-xs">
              Histórico cronológico com faturamento, quantidade de notas e variações mês a mês
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {report.evolucaoMensal.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhum dado mensal no período selecionado.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês / Ano</TableHead>
                        <TableHead className="text-center w-[100px]">Qtd Notas</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                        <TableHead className="text-right">Variação (%)</TableHead>
                        <TableHead className="text-right">Total Faturado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.evolucaoMensal.map((m) => (
                        <TableRow key={m.anoMes}>
                          <TableCell className="font-semibold text-xs">{m.label}</TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            {m.qtdNotas}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {formatCurrency(m.ticketMedio)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {m.variacaoAnteriorPercent !== null ? (
                              <span
                                className={
                                  m.variacaoAnteriorPercent >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                    : 'text-destructive font-semibold'
                                }
                              >
                                {m.variacaoAnteriorPercent >= 0 ? '+' : ''}
                                {formatPercentBR(m.variacaoAnteriorPercent)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold font-mono text-primary">
                            {formatCurrency(m.totalFaturado)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Cards mobile */}
                <div className="md:hidden divide-y divide-border/40 p-3 space-y-2.5">
                  {report.evolucaoMensal.map((m) => (
                    <div
                      key={m.anoMes}
                      className="pt-2.5 first:pt-0 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-foreground block">{m.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {m.qtdNotas} nfs · TM {formatCurrency(m.ticketMedio)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-primary block">
                          {formatCurrency(m.totalFaturado)}
                        </span>
                        {m.variacaoAnteriorPercent !== null && (
                          <span
                            className={`text-[10px] font-semibold ${
                              m.variacaoAnteriorPercent >= 0
                                ? 'text-emerald-600'
                                : 'text-destructive'
                            }`}
                          >
                            {m.variacaoAnteriorPercent >= 0 ? '+' : ''}
                            {formatPercentBR(m.variacaoAnteriorPercent)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. SEÇÃO: Top Produtos */}
      {report.secoes.includes('top_produtos') && (
        <Card className="glass-card shadow-card">
          <CardHeader className="pb-3 border-b border-border/30">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" /> Top Produtos
            </CardTitle>
            <CardDescription className="text-xs">
              Classificação por maior faturamento comercial no período
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {report.topProdutos.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhum produto faturado no período selecionado.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px] text-center">Posição</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Família</TableHead>
                        <TableHead className="text-center w-[80px]">Qtd Notas</TableHead>
                        <TableHead className="text-right w-[110px]">Participação</TableHead>
                        <TableHead className="text-right">Total Faturado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topProdutos.map((p) => (
                        <TableRow key={p.descricao + p.posicao}>
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {p.posicao}º
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-foreground">
                            {p.descricao}
                            {p.codigo && (
                              <span className="block text-[10px] text-muted-foreground font-mono">
                                {p.codigo}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{p.familia}</TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            {p.qtdNotas}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {formatPercentBR(p.participacaoPercent)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold font-mono text-primary">
                            {formatCurrency(p.totalFaturado)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Cards mobile */}
                <div className="md:hidden divide-y divide-border/40 p-3 space-y-2.5">
                  {report.topProdutos.map((p) => (
                    <div key={p.descricao + p.posicao} className="pt-2.5 first:pt-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-muted-foreground">
                              #{p.posicao}
                            </span>
                            <span className="text-xs font-bold text-foreground line-clamp-1">
                              {p.descricao}
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground block">
                            {p.familia}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold font-mono text-primary block">
                            {formatCurrency(p.totalFaturado)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatPercentBR(p.participacaoPercent)} ({p.qtdNotas} nfs)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
