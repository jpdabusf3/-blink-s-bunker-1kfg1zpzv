import { useAppContext } from '@/store/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCompactCurrency } from '@/lib/utils'
import { Download } from 'lucide-react'
import { MapCard } from '@/components/dashboard/MapCard'
import { ScoreEvolutionCard } from '@/components/dashboard/ScoreEvolutionCard'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { FactoryListCard } from '@/components/dashboard/FactoryListCard'

export default function Index() {
  const { factories } = useAppContext()

  const metrics = {
    revenue: factories.reduce((s, f) => s + f.potentialValue, 0),
    weighted: factories.reduce((s, f) => s + f.potentialValue * (f.winProbability / 100), 0),
    active: factories.filter((f) => f.status === 'Atendido').length,
    prospect: factories.filter((f) => f.status === 'Prospeção').length,
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10 print:m-0 print:p-0 print:space-y-8">
      {/* Print Header */}
      <div className="hidden print:block mb-8 border-b-2 border-primary pb-4">
        <h1 className="text-3xl font-bold text-primary mb-1">Relatório Executivo - MT</h1>
        <p className="text-muted-foreground text-sm">
          Inteligência Comercial Blink • Gerado em {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral MT</h1>
        <Button size="sm" onClick={() => window.print()} className="gap-2 shadow-sm">
          <Download className="w-5 h-5 md:w-4 md:h-4" /> Exportar Relatório PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-4 print:mb-8">
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-muted/10">
          <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
            Fábricas Mapeadas
          </h3>
          <div className="text-xl sm:text-3xl font-bold">{factories.length}</div>
        </Card>
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-muted/10">
          <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
            Ativas / Prospecção
          </h3>
          <div className="text-xl sm:text-3xl font-bold">
            {metrics.active} / {metrics.prospect}
          </div>
        </Card>
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-primary/5">
          <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
            Receita Potencial
          </h3>
          <div className="text-[12px] font-bold text-primary print:text-xl">
            {formatCompactCurrency(metrics.revenue)}
          </div>
        </Card>
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center p-4 print:border-none print:shadow-none print:bg-accent/5">
          <h3 className="text-[11px] sm:text-sm font-medium text-muted-foreground mb-1 leading-tight">
            Forecast Ponderado
          </h3>
          <div className="text-[12px] font-bold text-accent print:text-xl">
            {formatCompactCurrency(metrics.weighted)}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
        <MapCard />
        <ScoreEvolutionCard />
      </div>

      <DashboardCharts />

      <div className="grid grid-cols-1 gap-6 print:hidden">
        <FactoryListCard />
      </div>
    </div>
  )
}
