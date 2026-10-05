import { useRef, useCallback } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { ArrowRightLeft, ExternalLink, PhoneCall, Check } from 'lucide-react'
import { FunnelStage, type Factory } from '@/types'

const STAGES: FunnelStage[] = [
  'Lead',
  'Primeiro Contato',
  'Diagnóstico Técnico',
  'Apresentação',
  'Teste/Trial',
  'Proposta',
  'Negociação',
  'Fechamento',
  'Pós-venda',
  'Perda',
]

interface FunnelCardContextMenuWrapperProps {
  factory: Factory
  children: React.ReactNode
  onMoveToStage: (stage: FunnelStage) => void
  onOpenClient: () => void
  onQuickCall: () => void
}

export function FunnelCardContextMenuWrapper({
  factory,
  children,
  onMoveToStage,
  onOpenClient,
  onQuickCall,
}: FunnelCardContextMenuWrapperProps) {
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)

  // Suporte a long-press em mobile (500ms de pressão sem arrastar muito)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return
      // Simula evento de contextmenu para disparar o Radix ContextMenu
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
      })
      triggerRef.current.dispatchEvent(event)
    }, 500)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || !timerRef.current) return
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)
    // Se o usuário mover mais de 10px, cancela o long press (está rolando/arrastando)
    if (dx > 10 || dy > 10) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    touchStartPos.current = null
  }, [])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={triggerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="w-full"
        >
          {children}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56 text-xs">
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2 cursor-pointer">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
            <span>Mover para...</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 text-xs">
            {STAGES.map((stg) => {
              const isCurrent = factory.funnelStage === stg
              return (
                <ContextMenuItem
                  key={stg}
                  disabled={isCurrent}
                  onClick={() => onMoveToStage(stg)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className={isCurrent ? 'font-semibold text-primary' : ''}>{stg}</span>
                  {isCurrent && <Check className="w-3.5 h-3.5 text-primary ml-2" />}
                </ContextMenuItem>
              )
            })}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onOpenClient} className="gap-2 cursor-pointer">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Abrir cliente</span>
        </ContextMenuItem>

        <ContextMenuItem onClick={onQuickCall} className="gap-2 cursor-pointer">
          <PhoneCall className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Registrar ligação rápida</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
