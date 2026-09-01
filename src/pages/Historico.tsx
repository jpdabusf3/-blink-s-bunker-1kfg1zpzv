import { useHistorico } from '@/hooks/useHistorico'
import { HistoricoFilterBar } from '@/components/historico/HistoricoFilterBar'
import { HistoricoGranularitySelector } from '@/components/historico/HistoricoGranularitySelector'
import { HistoricoSummaryCards } from '@/components/historico/HistoricoSummaryCards'
import { HistoricoDataTable } from '@/components/historico/HistoricoDataTable'
import { HistoricoDetailModal } from '@/components/historico/HistoricoDetailModal'
import { HistoricoChart } from '@/components/historico/HistoricoChart'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw, History } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Historico() {
  const { toast } = useToast()
  const {
    draftFilters,
    setDraftFilters,
    granularity,
    setGranularity,
    loading,
    error,
    gestoresOptions,
    vendedoresOptions,
    summary,
    chartData,
    mensal,
    anual,
    quadrienal,
    detailModal,
    openDetail,
    closeDetail,
    applyFilters,
    resetFilters,
    fetchHistorico,
    exportCSV,
  } = useHistorico()

  const handleExport = () => {
    try {
      exportCSV()
      toast({
        title: 'Exportação concluída',
        description: 'Arquivo CSV gerado com sucesso.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de exportação',
        description: 'Erro ao exportar dados.',
      })
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Histórico de Vendas Unificado
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão combinada de NF-e (realizado) e pedidos pendentes (projetado) com múltiplos
              níveis de granularidade.
            </p>
          </div>
        </div>
      </div>

      {/* Seção 1: Barra de Filtros (sticky no topo) */}
      <HistoricoFilterBar
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        gestoresOptions={gestoresOptions}
        vendedoresOptions={vendedoresOptions}
        onApply={applyFilters}
        onReset={resetFilters}
        loading={loading}
      />

      {/* UX State: ERROR */}
      {error && (
        <div className="p-4 mb-6 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Erro ao carregar historico.</p>
              <p className="text-xs opacity-90">{error}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchHistorico}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Seção 2: Seletor de Granularidade */}
      <HistoricoGranularitySelector granularity={granularity} onChange={(g) => setGranularity(g)} />

      {/* Seção 3: Cards de Resumo */}
      <HistoricoSummaryCards summary={summary} loading={loading} />

      {/* Seção 4: Tabela de Dados */}
      <HistoricoDataTable
        granularity={granularity}
        mensalData={mensal}
        anualData={anual}
        quadrienalData={quadrienal}
        loading={loading}
        onRowClick={openDetail}
        onExportCSV={handleExport}
        onResetFilters={resetFilters}
      />

      {/* Seção 6: Gráfico (abaixo da tabela) */}
      <HistoricoChart data={chartData} loading={loading} />

      {/* Seção 5: Modal de Detalhe */}
      <HistoricoDetailModal detailModal={detailModal} onClose={closeDetail} />
    </div>
  )
}
