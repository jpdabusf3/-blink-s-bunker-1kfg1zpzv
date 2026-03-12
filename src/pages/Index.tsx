import { useAppContext } from '@/store/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCompactCurrency } from '@/lib/utils'
import { Download } from 'lucide-react'
import { MapCard } from '@/components/dashboard/MapCard'
import { ScoreEvolutionCard } from '@/components/dashboard/ScoreEvolutionCard'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { FactoryListCard } from '@/components/dashboard/FactoryListCard'

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
)

export default function Index() {
  const { factories, tasks } = useAppContext()

  const metrics = {
    revenue: factories.reduce((s, f) => s + f.potentialValue, 0),
    weighted: factories.reduce((s, f) => s + f.potentialValue * (f.winProbability / 100), 0),
    active: factories.filter((f) => f.status === 'Atendido').length,
    prospect: factories.filter((f) => f.status === 'Prospeção').length,
  }

  const handleWhatsAppShare = () => {
    let text = '*Resumo Operacional - Inteligência Comercial Blink*\n\n'

    const recentFactories = [...factories]
      .sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime())
      .slice(0, 5)

    text += '*Últimas Visitas/Interações:*\n'
    recentFactories.forEach((f) => {
      const date = new Date(f.lastInteraction).toLocaleDateString('pt-BR')
      text += `- ${f.name} (${date}): ${f.status} - ${f.funnelStage}\n`
    })

    const pendingTasks = tasks
      .filter((t) => !t.completed)
      .sort((a, b) => new Date(a.dueDate || '').getTime() - new Date(b.dueDate || '').getTime())

    text += '\n*Pendências:*\n'
    if (pendingTasks.length > 0) {
      pendingTasks.forEach((t) => {
        const date = t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : 'Sem data'
        const factory = factories.find((f) => f.id === t.factoryId)
        const factoryName = factory ? ` (${factory.name})` : ''
        text += `- [ ] ${t.description}${factoryName} (Venc: ${date})\n`
      })
    } else {
      text += 'Nenhuma pendência.\n'
    }

    const encodedText = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer')
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={handleWhatsAppShare}
            className="gap-2 shadow-sm bg-[#25D366] hover:bg-[#128C7E] text-white w-full sm:w-auto"
          >
            <WhatsAppIcon className="w-5 h-5" /> Compartilhar via WhatsApp
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2 shadow-sm w-full sm:w-auto"
          >
            <Download className="w-5 h-5 md:w-4 md:h-4" /> Exportar Relatório PDF
          </Button>
        </div>
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
