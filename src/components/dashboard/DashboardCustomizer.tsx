import { Sheet, SheetContent, SheetHeader, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Settings2, RotateCcw } from 'lucide-react'

const BLOCK_LABELS: Record<string, string> = {
  metrics: 'Métricas Gerais',
  executive: 'Dashboard Executivo',
  consolidated: 'Dashboard Consolidado (KPIs + Ranking)',
  targets: 'Metas e Targets',
  'role-widgets': 'Widgets por Perfil',
  maps: 'Mapas e Evolução',
  distribution: 'Distribuição',
  charts: 'Gráficos',
  historical: 'Comparativo Histórico',
  list: 'Lista de Fábricas',
  'gestor-comparison': 'Comparativo por Gestor Técnico',
}

export function DashboardCustomizer({
  blocks,
  onToggle,
  onReset,
}: {
  blocks: string[]
  onToggle: (blockId: string) => void
  onReset: () => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" /> Personalizar
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[320px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Personalizar Dashboard</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha quais blocos aparecerão no seu dashboard. A configuração é salva por usuário.
          </p>
          <div className="space-y-3">
            {Object.entries(BLOCK_LABELS).map(([id, label]) => (
              <div
                key={id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
              >
                <Label htmlFor={`block-${id}`} className="text-sm cursor-pointer">
                  {label}
                </Label>
                <Switch
                  id={`block-${id}`}
                  checked={blocks.includes(id)}
                  onCheckedChange={() => onToggle(id)}
                />
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={onReset}>
            <RotateCcw className="w-4 h-4" /> Restaurar Padrão
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
