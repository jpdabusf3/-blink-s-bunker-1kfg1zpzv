import { useAppContext } from '@/store/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
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
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral MT</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-2 print:hidden shadow-sm"
        >
          <Download className="w-4 h-4" /> Exportar Relatório PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fábricas Mapeadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{factories.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ativas / Prospecção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {metrics.active} / {metrics.prospect}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita Potencial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{formatCurrency(metrics.revenue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-subtle text-center flex flex-col justify-center items-center">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Forecast Ponderado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{formatCurrency(metrics.weighted)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MapCard />
        <ScoreEvolutionCard />
      </div>

      <DashboardCharts />

      <div className="grid grid-cols-1 gap-6 print:break-inside-avoid">
        <FactoryListCard />
      </div>
    </div>
  )
}
