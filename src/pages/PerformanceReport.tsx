import { useState, useEffect, useCallback } from 'react'
import { Loader2, FileSpreadsheet, FileText, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRealtime } from '@/hooks/use-realtime'
import { formatCurrency } from '@/lib/utils'
import {
  getGestoresTecnicos,
  getVendedoresGestao,
  type GestaoTecnica,
} from '@/services/gestao-tecnica'
import {
  fetchPerformanceData,
  DEFAULT_FILTERS,
  type PerformanceFilters as Filters,
  type PerformanceReportData,
} from '@/services/performance-report'
import { exportPerformanceToExcel, exportPerformanceToPDF } from '@/lib/exportPerformance'
import { PerformanceFilters as FilterBar } from '@/components/performance/PerformanceFilters'
import { PerformanceTables } from '@/components/performance/PerformanceTables'

export default function PerformanceReport() {
  const [data, setData] = useState<PerformanceReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [gestores, setGestores] = useState<GestaoTecnica[]>([])
  const [vendedores, setVendedores] = useState<GestaoTecnica[]>([])

  const updateFilter = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const loadData = useCallback(async () => {
    try {
      const result = await fetchPerformanceData(filters)
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    Promise.all([getGestoresTecnicos(), getVendedoresGestao()])
      .then(([g, v]) => {
        setGestores(g)
        setVendedores(v)
      })
      .catch(() => {})
  }, [])

  useRealtime('historico_vendas', () => loadData())
  useRealtime('matriz_vendas', () => loadData())
  useRealtime('metas', () => loadData())

  if (loading || !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const s = data.summary

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Award className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatório de Performance</h1>
            <p className="text-muted-foreground text-sm">
              Performance individual de gestores técnicos e vendedores
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => exportPerformanceToExcel(data)}
          >
            <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => exportPerformanceToPDF(data)}>
            <FileText className="w-4 h-4" /> Gerar PDF
          </Button>
        </div>
      </div>

      <FilterBar
        filters={filters}
        onChange={updateFilter}
        gestores={gestores}
        vendedores={vendedores}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="shadow-subtle">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{s.totalVendas}</p>
            <p className="text-xs text-muted-foreground">Total de Vendas</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{formatCurrency(s.valorTotal)}</p>
            <p className="text-xs text-muted-foreground">Valor Total</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{formatCurrency(s.ticketMedio)}</p>
            <p className="text-xs text-muted-foreground">Ticket Médio</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{s.numClientes}</p>
            <p className="text-xs text-muted-foreground">Clientes Atendidos</p>
          </CardContent>
        </Card>
        <Card className="shadow-subtle">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{s.taxaConversao.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
          </CardContent>
        </Card>
      </div>

      <PerformanceTables
        gestores={data.gestores}
        vendedores={data.vendedores}
        gestorRanking={data.gestorRanking}
        vendedorRanking={data.vendedorRanking}
      />
    </div>
  )
}
