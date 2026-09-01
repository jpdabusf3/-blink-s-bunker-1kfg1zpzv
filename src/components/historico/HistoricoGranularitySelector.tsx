import { type HistoricoGranularity } from '@/services/historicoService'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDays, Layers } from 'lucide-react'

interface HistoricoGranularitySelectorProps {
  granularity: HistoricoGranularity
  onChange: (g: HistoricoGranularity) => void
}

export function HistoricoGranularitySelector({
  granularity,
  onChange,
}: HistoricoGranularitySelectorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-card border border-border p-3 rounded-xl shadow-sm">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Visão Temporal:</span>
      </div>

      <div className="inline-flex rounded-lg bg-muted p-1 border border-border">
        <Button
          type="button"
          size="sm"
          variant={granularity === 'mensal' ? 'default' : 'ghost'}
          onClick={() => onChange('mensal')}
          className={`h-8 px-4 text-xs font-medium rounded-md transition-all gap-1.5 ${
            granularity === 'mensal'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Mensal
        </Button>

        <Button
          type="button"
          size="sm"
          variant={granularity === 'anual' ? 'default' : 'ghost'}
          onClick={() => onChange('anual')}
          className={`h-8 px-4 text-xs font-medium rounded-md transition-all gap-1.5 ${
            granularity === 'anual'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Anual
        </Button>

        <Button
          type="button"
          size="sm"
          variant={granularity === 'quadrienal' ? 'default' : 'ghost'}
          onClick={() => onChange('quadrienal')}
          className={`h-8 px-4 text-xs font-medium rounded-md transition-all gap-1.5 ${
            granularity === 'quadrienal'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Quadrienal
        </Button>
      </div>
    </div>
  )
}
