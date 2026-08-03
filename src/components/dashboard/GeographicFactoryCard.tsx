import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { MapPin, User, ArrowRight, Tag } from 'lucide-react'
import type { Factory } from '@/types'

interface GeographicFactoryCardProps {
  factory: Factory
}

export function GeographicFactoryCard({ factory }: GeographicFactoryCardProps) {
  const nextSteps = factory.suggested_approach || factory.notes || ''

  return (
    <Card className="p-3 shadow-subtle hover:shadow-md transition-all flex flex-col justify-between border-l-4 border-l-primary">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-sm leading-tight text-foreground">{factory.name}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-primary shrink-0" />
              {[factory.city, factory.state, factory.country].filter(Boolean).join(' • ') || 'N/A'}
            </p>
          </div>
          <Badge
            variant={
              factory.status === 'Atendido'
                ? 'default'
                : factory.status === 'Prospeção'
                  ? 'secondary'
                  : 'outline'
            }
            className="text-[10px] shrink-0"
          >
            {factory.status}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground pt-1">
          {factory.profile_type && (
            <Badge variant="outline" className="text-[10px] gap-1 bg-muted/30">
              <Tag className="w-3 h-3" />
              {factory.profile_type}
            </Badge>
          )}
          {factory.animalSpecies && (
            <Badge variant="secondary" className="text-[10px]">
              {factory.animalSpecies}
            </Badge>
          )}
          {factory.funnelStage && (
            <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border-none">
              {factory.funnelStage}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t">
          <span className="text-muted-foreground font-medium">Potencial:</span>
          <span className="font-bold text-primary">{formatCurrency(factory.potentialValue)}</span>
        </div>

        <div className="text-xs flex items-center gap-1 text-muted-foreground">
          <User className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">
            Gestor Técnico:{' '}
            <strong className="text-foreground font-semibold">
              {factory.salesOwnerName || factory.salesOwner || 'Não atribuído'}
            </strong>
          </span>
        </div>

        {nextSteps && (
          <div className="text-[11px] bg-muted/40 p-2 rounded-md border text-muted-foreground space-y-0.5 mt-2">
            <div className="font-semibold text-primary flex items-center gap-1">
              <ArrowRight className="w-3 h-3" />
              Próximos Passos:
            </div>
            <p className="line-clamp-2 italic">{nextSteps}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
