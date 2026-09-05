import { useState, useEffect, useCallback } from 'react'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import {
  fetchPerformanceData,
  DEFAULT_FILTERS,
  type PerformanceReportData,
  type PerformanceFilters,
} from '@/services/performance-report'
import { exportPerformanceToExcel, exportPerformanceToPDF } from '@/lib/exportPerformance'
import { PerformanceFilters as PerfFilters } from '@/components/performance/PerformanceFilters'
import { PerformanceReportTable } from '@/components/performance/PerformanceReportTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, FileSpreadsheet, FileText, Trophy, Medal, Award } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function RelatorioPerformance() {
  const [data, setData] = useState<PerformanceReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])
  const [filters, setFilters] = useState<PerformanceFilters>(DEFAULT_FILTERS)

  const updateFilter = (key: keyof PerformanceFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const loadData = useCallback(async () => {
    try {
      const result = await fetchPerformanceData(filters)
      setData(result)
    } catch {
      /* noop */
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    getGestoresTecnicos()
      .then(setGestores)
      .catch(() => {})
    getVendedoresGestao()
      .then(setVendedores)
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('historico_vendas', () => loadData())
  useRealtime('matriz_vendas', () => loadData())
  useRealtime('metas', () => loadData())

  if (loading && !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) return null

  const rankIcons = [Trophy, Medal, Award]

  const renderRanking = (ranking: { nome: string; valor: number }[]) => (
    <div className="space-y-2">
      {ranking.map((item, i) => {
        const Icon = i < 3 ? rankIcons[i] : null
        return (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}º</span>
              {Icon && <Icon className="w-4 h-4 text-primary" />}
              <span className="font-medium">{item.nome}</span>
            </div>
            <span className="font-bold text-primary">{formatCurrency(item.valor)}</span>
          </div>
        )
      })}
      {ranking.length === 0 && <p className="text-center text-muted-foreground py-4">Sem dados</p>}
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Performance</h1>
          <p className="text-muted-foreground text-sm">
            Acompanhe a performance individual de gestores e vendedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportPerformanceToExcel(data)}
            disabled={loading}
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportPerformanceToPDF(data)}
            disabled={loading}
          >
            <FileText className="w-4 h-4" /> Gerar PDF
          </Button>
        </div>
      </div>

      <PerfFilters
        filters={filters}
        onChange={updateFilter}
        gestores={gestores}
        vendedores={vendedores}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total de Vendas', value: String(data.summary.totalVendas) },
          { label: 'Valor Total', value: formatCurrency(data.summary.valorTotal) },
          { label: 'Ticket Médio', value: formatCurrency(data.summary.ticketMedio) },
          { label: 'Clientes Atendidos', value: String(data.summary.numClientes) },
          { label: 'Taxa de Conversão', value: `${data.summary.taxaConversao.toFixed(1)}%` },
        ].map((kpi) => (
          <Card key={kpi.label} className="shadow-subtle">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Relatório por Gestor Técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceReportTable members={data.gestores} relacionadoLabel="Vendedores" />
        </CardContent>
      </Card>

      <Card className="shadow-subtle">
        <CardHeader>
          <CardTitle>Relatório por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceReportTable members={data.vendedores} relacionadoLabel="Gestores" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Ranking de Gestores
            </CardTitle>
          </CardHeader>
          <CardContent>{renderRanking(data.gestorRanking)}</CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Ranking de Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>{renderRanking(data.vendedorRanking)}</CardContent>
        </Card>
      </div>
    </div>
  )
}
