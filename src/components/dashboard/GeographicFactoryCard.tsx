import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Factory } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { MapPin, TrendingUp, Package, UserCog } from 'lucide-react'

const PRIORITY_STYLES: Record<string, string> = {
  High: 'bg-red-500/10 text-red-600 border-red-500/20',
  Medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  Low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}

const STATUS_STYLES: Record<string, string> = {
  Atendido: 'bg-green-500/10 text-green-600 border-green-500/20',
  Prospeção: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  'Não atendido': 'bg-gray-500/10 text-gray-600 border-gray-500/20',
}

export function GeographicFactoryCard({ factory }: { factory: Factory }) {
  return (
    <Card className="shadow-subtle hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{factory.name}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {[factory.city, factory.state, factory.country].filter(Boolean).join(', ') || 'N/A'}
              </span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-primary">
              {formatCurrency(factory.potentialValue)}
            </div>
            <div className="text-[10px] text-muted-foreground">Potencial</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {factory.priority && (
            <Badge
              variant="outline"
              className={`text-[10px] ${PRIORITY_STYLES[factory.priority] || ''}`}
            >
              {factory.priority === 'High'
                ? 'Alta'
                : factory.priority === 'Medium'
                  ? 'Média'
                  : 'Baixa'}
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[factory.status] || ''}`}>
            {factory.status}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {factory.funnelStage}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
          <span className="flex items-center gap-1 truncate">
            <Package className="w-3 h-3 shrink-0" />
            <span className="truncate">{factory.specialty || factory.sector || 'N/A'}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <TrendingUp className="w-3 h-3" />
            {factory.winProbability}%
          </span>
        </div>
        {factory.salesOwnerName && (
          <div className="flex items-center gap-1 text-xs text-primary pt-1">
            <UserCog className="w-3 h-3 shrink-0" />
            <span className="truncate font-medium">{factory.salesOwnerName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
