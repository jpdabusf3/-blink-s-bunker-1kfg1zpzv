import { Mic, PencilLine, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

const ORIGIN_CONFIG: Record<string, { icon: typeof Mic; label: string; color: string }> = {
  audio: { icon: Mic, label: 'Áudio', color: 'text-blue-500' },
  manual: { icon: PencilLine, label: 'Manual', color: 'text-emerald-500' },
  excel: { icon: FileSpreadsheet, label: 'Planilha', color: 'text-amber-500' },
}

export function OriginIndicator({ origem }: { origem: string }) {
  const config = ORIGIN_CONFIG[origem]
  if (!config) return <span className="text-xs text-muted-foreground">—</span>
  const Icon = config.icon
  return (
    <div className="flex items-center gap-1.5" title={`Origem: ${config.label}`}>
      <Icon className={cn('w-4 h-4', config.color)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  )
}
