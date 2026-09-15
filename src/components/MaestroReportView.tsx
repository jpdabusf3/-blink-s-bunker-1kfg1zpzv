import { useMemo } from 'react'
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
import {
  Download,
  DollarSign,
  ShoppingCart,
  Users,
  Layers,
  Sparkles,
  Calendar,
  Filter,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { type ResumoVendasResponse } from '@/services/resumo-vendas'
import { type MaestroReportConfig } from '@/services/maestro-service'
import { familiaCompleta } from '@/constants/familiaProdutos'

interface MaestroReportViewProps {
  reportData: ResumoVendasResponse
  config: MaestroReportConfig | null
  generatedAt: Date
}

export function MaestroReportView({ reportData, config, generatedAt }: MaestroReportViewProps) {
  const faturadoBrl = reportData.faturado_total_brl ?? 0
  const faturadoUsd = reportData.faturado_total_usd ?? 0
  const qtdNotas = reportData.quantidade_notas ?? 0
  const ticketMedio = qtdNotas > 0 ? faturadoBrl / qtdNotas : null
  const carteiraBrl = reportData.carteira_total_brl
  const coberturaPercent = reportData.cobertura_percent

  const showFaturamento = config?.dados_inclusos?.faturamento !== false
  const showPedidos = config?.dados_inclusos?.pedidos !== false
  const showTopClientes = config?.dados_inclusos?.top_clientes !== false
  const showFamilias = config?.dados_inclusos?.familias !== false
  const showCobertura = config?.dados_inclusos?.cobertura !== false

  // Formatação de data brasileira DD/MM/AAAA
  const formattedGeneratedDate = useMemo(() => {
    const d = generatedAt.getDate().toString().padStart(2, '0')
    const m = (generatedAt.getMonth() + 1).toString().padStart(2, '0')
    const y = generatedAt.getFullYear()
    return `${d}/${m}/${y}`
  }, [generatedAt])

  const formattedGeneratedDateTime = useMemo(() => {
    const d = generatedAt.getDate().toString().padStart(2, '0')
    const m = (generatedAt.getMonth() + 1).toString().padStart(2, '0')
    const y = generatedAt.getFullYear()
    const hours = generatedAt.getHours().toString().padStart(2, '0')
    const mins = generatedAt.getMinutes().toString().padStart(2, '0')
    return `${d}/${m}/${y} às ${hours}:${mins}`
  }, [generatedAt])

  // Filtragem de clientes e famílias com base em filtros informados
  const filteredClientes = useMemo(() => {
    let list = reportData.por_cliente || []
    if (config?.filtros?.cliente) {
      const q = config.filtros.cliente.toLowerCase()
      list = list.filter((c) => c.cliente.toLowerCase().includes(q))
    }
    return list.slice(0, 10)
  }, [reportData.por_cliente, config?.filtros?.cliente])

  const filteredFamilias = useMemo(() => {
    return reportData.por_familia || []
  }, [reportData.por_familia])

  // Exportação CSV conforme requisitos:
  // - Cabeçalhos em português
  // - Datas DD/MM/AAAA
  // - Moeda formatada em R$
  // - Nome de arquivo: relatorio-vendas-YYYY-MM-DD.csv
  const handleExportCSV = () => {
    const yyyy = generatedAt.getFullYear()
    const mm = (generatedAt.getMonth() + 1).toString().padStart(2, '0')
    const dd = generatedAt.getDate().toString().padStart(2, '0')
    const filename = `relatorio-vendas-${yyyy}-${mm}-${dd}.csv`

    const csvLines: string[] = []

    // Cabeçalho institucional do relatório
    csvLines.push('"RELATÓRIO DE VENDAS PERSONALIZADO - MAESTRO"')
    csvLines.push(`"Data de Geração";"${formattedGeneratedDate}"`)
    csvLines.push(`"Período de Referência";"${reportData.periodo || 'Personalizado'}"`)

    if (config?.filtros) {
      const activeFilters: string[] = []
      if (config.filtros.segmento) activeFilters.push(`Segmento: ${config.filtros.segmento}`)
      if (config.filtros.marca) activeFilters.push(`Marca: ${config.filtros.marca}`)
      if (config.filtros.cliente) activeFilters.push(`Cliente: ${config.filtros.cliente}`)
      if (config.filtros.estado) activeFilters.push(`Estado: ${config.filtros.estado}`)
      if (config.filtros.pais) activeFilters.push(`País: ${config.filtros.pais}`)
      if (activeFilters.length > 0) {
        csvLines.push(`"Filtros Aplicados";"${activeFilters.join(' | ')}"`)
      }
    }

    csvLines.push('')

    // Resumo Geral / KPIs
    csvLines.push('"RESUMO GERAL"')
    csvLines.push('"Indicador";"Valor"')
    csvLines.push(`"Faturamento Total (R$)";"${formatCurrency(faturadoBrl)}"`)
    if (faturadoUsd > 0) {
      csvLines.push(
        `"Faturamento Total (USD)";"US$ ${faturadoUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`,
      )
    }
    csvLines.push(`"Quantidade de Pedidos / Notas";"${qtdNotas}"`)
    if (ticketMedio !== null) {
      csvLines.push(`"Ticket Médio (R$)";"${formatCurrency(ticketMedio)}"`)
    }
    if (carteiraBrl !== null && carteiraBrl !== undefined) {
      csvLines.push(`"Carteira Total (R$)";"${formatCurrency(carteiraBrl)}"`)
    }
    if (coberturaPercent !== null && coberturaPercent !== undefined) {
      csvLines.push(`"Cobertura da Carteira";"${coberturaPercent.toFixed(1).replace('.', ',')}%"`)
    }

    // Top Clientes
    if (filteredClientes.length > 0) {
      csvLines.push('')
      csvLines.push('"TOP CLIENTES"')
      csvLines.push('"Posição";"Nome do Cliente";"Faturamento Total (R$)"')
      filteredClientes.forEach((c, idx) => {
        csvLines.push(
          `"${idx + 1}";"${c.cliente.replace(/"/g, '""')}";"${formatCurrency(c.valor_brl)}"`,
        )
      })
    }

    // Famílias de Produtos
    if (filteredFamilias.length > 0) {
      csvLines.push('')
      csvLines.push('"FATURAMENTO POR FAMÍLIA DE PRODUTOS"')
      csvLines.push('"Posição";"Família de Produtos";"Faturamento Total (R$)"')
      filteredFamilias.forEach((f, idx) => {
        const nomeFam = familiaCompleta('', f.familia)
        csvLines.push(
          `"${idx + 1}";"${nomeFam.replace(/"/g, '""')}";"${formatCurrency(f.valor_brl)}"`,
        )
      })
    }

    const csvContent = '\uFEFF' + csvLines.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 pt-2 animate-fade-in">
      {/* Top Banner de Relatório Gerado */}
      <div className="rounded-lg border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h4 className="font-bold text-sm text-foreground">Relatório de Vendas MAESTRO</h4>
            <Badge
              variant="outline"
              className="border-primary/40 text-primary text-[10px] font-semibold"
            >
              Gerado pelo Assistente
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Período:{' '}
              <strong className="text-foreground">{reportData.periodo || 'Personalizado'}</strong>
            </span>
            <span>•</span>
            <span>Data: {formattedGeneratedDateTime}</span>
          </div>
        </div>

        <Button
          onClick={handleExportCSV}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shadow-xs shrink-0 h-9"
        >
          <Download className="w-4 h-4" />
          <span>Exportar CSV</span>
        </Button>
      </div>

      {/* Informações dos filtros interpretados se houver */}
      {config?.filtros && (
        <div className="flex flex-wrap items-center gap-2 text-xs bg-muted/40 p-2.5 rounded-md border border-border/40">
          <span className="font-medium flex items-center gap-1 text-muted-foreground">
            <Filter className="w-3.5 h-3.5 text-primary" /> Filtros aplicados:
          </span>
          {config.filtros.segmento && (
            <Badge variant="secondary" className="text-[11px]">
              Segmento: {config.filtros.segmento}
            </Badge>
          )}
          {config.filtros.marca && (
            <Badge variant="secondary" className="text-[11px]">
              Marca: {config.filtros.marca}
            </Badge>
          )}
          {config.filtros.cliente && (
            <Badge variant="secondary" className="text-[11px]">
              Cliente: {config.filtros.cliente}
            </Badge>
          )}
          {config.filtros.estado && (
            <Badge variant="secondary" className="text-[11px]">
              UF: {config.filtros.estado}
            </Badge>
          )}
          {config.filtros.pais && (
            <Badge variant="secondary" className="text-[11px]">
              País: {config.filtros.pais}
            </Badge>
          )}
          {!config.filtros.segmento &&
            !config.filtros.marca &&
            !config.filtros.cliente &&
            !config.filtros.estado &&
            !config.filtros.pais && (
              <span className="text-muted-foreground italic">Visão global consolidada</span>
            )}
        </div>
      )}

      {/* Cards de KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {showFaturamento && (
          <Card className="glass-card border-l-2 border-l-primary shadow-xs">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Faturamento</span>
                <DollarSign className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-base sm:text-lg font-bold text-foreground mt-1">
                {formatCurrency(faturadoBrl)}
              </div>
              {faturadoUsd > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  US${' '}
                  {faturadoUsd.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showPedidos && (
          <Card className="glass-card border-l-2 border-l-amber-500 shadow-xs">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Pedidos / Notas</span>
                <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-base sm:text-lg font-bold text-foreground mt-1">{qtdNotas}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Ticket: {ticketMedio !== null ? formatCurrency(ticketMedio) : '—'}
              </div>
            </CardContent>
          </Card>
        )}

        {showTopClientes && (
          <Card className="glass-card border-l-2 border-l-sky-500 shadow-xs">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Top Clientes</span>
                <Users className="w-3.5 h-3.5 text-sky-500" />
              </div>
              <div className="text-base sm:text-lg font-bold text-foreground mt-1">
                {reportData.por_cliente?.length ?? 0}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Identificados no período
              </div>
            </CardContent>
          </Card>
        )}

        {showCobertura && (
          <Card className="glass-card border-l-2 border-l-emerald-500 shadow-xs">
            <CardContent className="p-3">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Cobertura</span>
                <Layers className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-base sm:text-lg font-bold text-foreground mt-1">
                {coberturaPercent !== null && coberturaPercent !== undefined
                  ? `${coberturaPercent.toFixed(1).replace('.', ',')}%`
                  : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {carteiraBrl ? `Carteira: ${formatCurrency(carteiraBrl)}` : 'Sem carteira definida'}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabelas de Detalhes: Top Clientes e Famílias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tabela Top Clientes */}
        {showTopClientes && (
          <Card className="glass-card border border-border/40 shadow-xs">
            <CardHeader className="p-3 pb-2 border-b border-border/30">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Top Clientes
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {filteredClientes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-60 overflow-y-auto">
              {filteredClientes.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhum cliente no período.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead className="text-[11px] h-7 w-8 text-center">#</TableHead>
                      <TableHead className="text-[11px] h-7">Cliente</TableHead>
                      <TableHead className="text-[11px] h-7 text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((item, idx) => (
                      <TableRow key={`rep-cli-${idx}`} className="border-border/20">
                        <TableCell className="text-[11px] py-1.5 text-center text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5 font-medium truncate max-w-[140px]">
                          {item.cliente || 'Outros'}
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono text-primary font-semibold">
                          {formatCurrency(item.valor_brl)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabela Famílias */}
        {showFamilias && (
          <Card className="glass-card border border-border/40 shadow-xs">
            <CardHeader className="p-3 pb-2 border-b border-border/30">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" /> Famílias de Produtos
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {filteredFamilias.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-60 overflow-y-auto">
              {filteredFamilias.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Nenhuma família no período.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead className="text-[11px] h-7 w-8 text-center">#</TableHead>
                      <TableHead className="text-[11px] h-7">Família</TableHead>
                      <TableHead className="text-[11px] h-7 text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFamilias.map((item, idx) => (
                      <TableRow key={`rep-fam-${idx}`} className="border-border/20">
                        <TableCell className="text-[11px] py-1.5 text-center text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5 font-medium truncate max-w-[140px]">
                          {familiaCompleta('', item.familia)}
                        </TableCell>
                        <TableCell className="text-[11px] py-1.5 text-right font-mono text-primary font-semibold">
                          {formatCurrency(item.valor_brl)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
