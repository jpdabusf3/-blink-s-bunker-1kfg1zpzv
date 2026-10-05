import { Phone, MessageCircle, Edit3 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Factory } from '@/types'

interface FunnelCardActionBarProps {
  factory: Factory
  onQuickCall: (e: React.MouseEvent) => void
  onWhatsApp: (e: React.MouseEvent) => void
  onOpenDrawer: (e: React.MouseEvent) => void
}

export function FunnelCardActionBar({
  factory,
  onQuickCall,
  onWhatsApp,
  onOpenDrawer,
}: FunnelCardActionBarProps) {
  return (
    <div
      data-action-bar
      className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 mt-2.5 pt-2 border-t flex items-center justify-end gap-1.5"
      onClick={(e) => {
        // Evita que o clique na barra propague para o Card abrindo o drawer inadvertidamente
        e.stopPropagation()
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Registrar ligação com ${factory.name}`}
            onClick={onQuickCall}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Registrar ligação
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Enviar mensagem no WhatsApp para ${factory.name}`}
            onClick={onWhatsApp}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          WhatsApp
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Abrir detalhes de ${factory.name}`}
            onClick={onOpenDrawer}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Abrir gaveta
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
