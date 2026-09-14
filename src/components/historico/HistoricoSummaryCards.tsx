import { type HistoricoSummary } from '@/services/historicoService'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { CheckCircle2, TrendingUp, DollarSign, FileText } from 'lucide-react'

interface HistoricoSummaryCardsProps {
  summary: HistoricoSummary
  loading: boolean
}

export function HistoricoSummaryCards({ summary, loading }: HistoricoSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border border-border/60 bg-card shadow-sm">
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Total Realizado */}
      <Card className="glass-card hover-lift border-emerald-500/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              Total Realizado
            </p>
            <h4 className="text-[28px] font-extrabold tabular-nums text-foreground mt-1">
              {formatCurrency(summary.totalRealizado)}
            </h4>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              Vendas NF-e confirmadas
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Total Projetado */}
      <Card className="glass-card hover-lift border-blue-500/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              Total Projetado
            </p>
            <h4 className="text-[28px] font-extrabold tabular-nums text-foreground mt-1">
              {formatCurrency(summary.totalProjetado)}
            </h4>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
              Pedidos pendentes
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Ticket Médio */}
      <Card className="glass-card hover-lift border-amber-500/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              Ticket Médio
            </p>
            <h4 className="text-[28px] font-extrabold tabular-nums text-foreground mt-1">
              {formatCurrency(summary.ticketMedio)}
            </h4>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
              Por NF realizada
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Qtd Documentos */}
      <Card className="glass-card hover-lift border-purple-500/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              Qtd Documentos
            </p>
            <h4 className="text-[28px] font-extrabold tabular-nums text-foreground mt-1">
              {summary.qtdDocumentos.toLocaleString('pt-BR')}
            </h4>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
              NFs e Pedidos distintos
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <FileText className="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
