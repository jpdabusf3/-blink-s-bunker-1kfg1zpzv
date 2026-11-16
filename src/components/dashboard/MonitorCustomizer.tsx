import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ChevronDown, ChevronUp, RotateCcw, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { monitorSectionLabel } from '@/components/dashboard/MonitorMode'
import {
  MONITOR_DURATION_OPTIONS_S,
  sectionDuration,
  type MonitorPreferences,
} from '@/services/monitor-preferences'

interface MonitorCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefs: MonitorPreferences
  onToggle: (id: string, visible: boolean) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onDuration: (id: string, seconds: number) => void
  onReset: () => void
}

/**
 * Personalização do Modo Monitor: liga/desliga cada seção, reordena a rotação
 * (mover para cima/baixo) e escolhe a duração por seção. Aberto pela engrenagem
 * dentro do modo monitor (MonitorChrome). Salva no ato — não há "salvar".
 */
export function MonitorCustomizer({
  open,
  onOpenChange,
  prefs,
  onToggle,
  onMove,
  onDuration,
  onReset,
}: MonitorCustomizerProps) {
  const activeCount = prefs.sections.filter((s) => s.visible).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#2A2A31] border-[#3A3A42] text-white max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto"
        // Esc dentro do painel fecha APENAS o painel — não pode sair do monitor.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Settings2 className="w-4 h-4 text-[#E5B64E]" />
            Personalizar Modo Monitor
          </DialogTitle>
          <DialogDescription className="text-[#A1A1AA]">
            Ordem, visibilidade e tempo de cada seção da rotação. Salvo automaticamente para o seu
            usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {prefs.sections.map((section, index) => {
            const duration = sectionDuration(prefs, section.id)
            const isFirst = index === 0
            const isLast = index === prefs.sections.length - 1
            return (
              <div
                key={section.id}
                className={cn(
                  'rounded-[12px] border p-3 bg-[#232329] transition-opacity',
                  section.visible ? 'border-[#3A3A42]' : 'border-[#3A3A42]/60 opacity-60',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex flex-col shrink-0">
                      <button
                        type="button"
                        aria-label="Mover para cima"
                        disabled={isFirst || !section.visible}
                        onClick={() => onMove(section.id, 'up')}
                        className="text-[#A1A1AA] hover:text-white disabled:opacity-25 disabled:hover:text-[#A1A1AA]"
                      >
                        <ChevronUp className="w-4 h-4" />
                        <span className="sr-only">Mover para cima</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Mover para baixo"
                        disabled={isLast || !section.visible}
                        onClick={() => onMove(section.id, 'down')}
                        className="text-[#A1A1AA] hover:text-white disabled:opacity-25 disabled:hover:text-[#A1A1AA]"
                        style={{ marginTop: -4 }}
                      >
                        <ChevronDown className="w-4 h-4" />
                        <span className="sr-only">Mover para baixo</span>
                      </button>
                    </div>
                    <Label
                      htmlFor={`monitor-section-${section.id}`}
                      className="text-sm cursor-pointer text-white truncate"
                    >
                      {monitorSectionLabel(section.id)}
                    </Label>
                  </div>
                  <Switch
                    id={`monitor-section-${section.id}`}
                    checked={section.visible}
                    onCheckedChange={(v) => onToggle(section.id, v)}
                  />
                </div>

                {section.visible && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-[#A1A1AA] mr-1">Tempo:</span>
                    {MONITOR_DURATION_OPTIONS_S.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onDuration(section.id, s)}
                        className={cn(
                          'h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-colors',
                          duration === s
                            ? 'bg-[#E5B64E] border-[#E5B64E] text-[#1F1F1F]'
                            : 'bg-transparent border-[#3A3A42] text-[#A1A1AA] hover:text-white hover:border-[#A1A1AA]',
                        )}
                      >
                        {s}s
                      </button>
                    ))}
                    {duration !== 30 && (
                      <span className="text-[10px] text-[#A1A1AA] ml-1">(padrão: 30s)</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-[#A1A1AA]">
            {activeCount} de {prefs.sections.length} seções ativas
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-[#232329] border-[#3A3A42] text-white hover:bg-[#3A3A42]"
            onClick={onReset}
          >
            <RotateCcw className="w-4 h-4" /> Restaurar padrão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
