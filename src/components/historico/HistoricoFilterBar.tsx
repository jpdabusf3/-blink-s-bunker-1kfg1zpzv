import { type HistoricoFilters } from '@/services/historicoService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, RotateCcw, ChevronDown, Check } from 'lucide-react'

export const ESPECIE_LIST = [
  'PET',
  'AVES',
  'SUINOS',
  'RUMINANTES',
  'AQUA',
  'DISTRIBUICAO',
  'OUTRO',
] as const

export const CANAL_VENDAS_LIST = [
  'Direto',
  'Distribuidor',
  'Industria',
  'Premixera',
  'Cooperativa',
  'Online',
] as const

export const PAIS_LIST = ['Brasil', 'Paraguai', 'Chile'] as const

export const FAMILIA_PRODUTO_LIST = [
  'Minerais Orgânicos',
  'Adsorventes',
  'Ingredientes',
  'Prebióticos',
  'Blends',
] as const

interface HistoricoFilterBarProps {
  draftFilters: HistoricoFilters
  setDraftFilters: React.Dispatch<React.SetStateAction<HistoricoFilters>>
  gestoresOptions?: string[]
  vendedoresOptions: string[]
  onApply: () => void
  onReset: () => void
  loading?: boolean
}

export function HistoricoFilterBar({
  draftFilters,
  setDraftFilters,
  vendedoresOptions,
  onApply,
  onReset,
  loading = false,
}: HistoricoFilterBarProps) {
  // Handle Multi-selection of Especies
  const selectedEspecies = draftFilters.especie || ['Todos']
  const isAllEspecies = selectedEspecies.includes('Todos') || selectedEspecies.length === 0

  const toggleEspecie = (esp: string) => {
    if (esp === 'Todos') {
      setDraftFilters((prev) => ({ ...prev, especie: ['Todos'] }))
      return
    }

    let next: string[]
    if (isAllEspecies) {
      next = [esp]
    } else if (selectedEspecies.includes(esp)) {
      next = selectedEspecies.filter((e) => e !== esp)
      if (next.length === 0) next = ['Todos']
    } else {
      next = [...selectedEspecies.filter((e) => e !== 'Todos'), esp]
    }

    setDraftFilters((prev) => ({ ...prev, especie: next }))
  }

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shadow-sm p-4 mb-6 rounded-xl transition-all">
      <div className="flex flex-col gap-4">
        {/* Top bar headline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Filtros de Vendas Unificado</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="toggle-realizado"
                checked={draftFilters.mostrarApenasRealizado}
                onCheckedChange={(checked) =>
                  setDraftFilters((prev) => ({ ...prev, mostrarApenasRealizado: checked }))
                }
              />
              <Label
                htmlFor="toggle-realizado"
                className="text-xs font-medium cursor-pointer text-muted-foreground select-none"
              >
                Mostrar apenas realizado
              </Label>
            </div>
          </div>
        </div>

        {/* Filter controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
          {/* Especie (Multi-select popover) */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Espécie</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-xs h-9 font-normal px-2.5 overflow-hidden"
                >
                  <span className="truncate">
                    {isAllEspecies
                      ? 'Todas Espécies'
                      : selectedEspecies.length === 1
                        ? selectedEspecies[0]
                        : `${selectedEspecies.length} selecionadas`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 space-y-1 text-xs" align="start">
                <div
                  onClick={() => toggleEspecie('Todos')}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer font-medium"
                >
                  <Checkbox checked={isAllEspecies} />
                  <span>Todos</span>
                </div>
                <div className="border-t my-1 border-border" />
                {ESPECIE_LIST.map((esp) => {
                  const checked = !isAllEspecies && selectedEspecies.includes(esp)
                  return (
                    <div
                      key={esp}
                      onClick={() => toggleEspecie(esp)}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                    >
                      <Checkbox checked={checked} />
                      <span className="flex-1">{esp}</span>
                      {checked && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  )
                })}
              </PopoverContent>
            </Popover>
          </div>

          {/* Vendedor */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Vendedor</Label>
            <Select
              value={draftFilters.vendedor || 'Todos'}
              onValueChange={(val) => setDraftFilters((prev) => ({ ...prev, vendedor: val }))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {vendedoresOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Canal de Vendas */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Canal de Vendas</Label>
            <Select
              value={draftFilters.canal_vendas || 'Todos'}
              onValueChange={(val) => setDraftFilters((prev) => ({ ...prev, canal_vendas: val }))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {CANAL_VENDAS_LIST.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* País */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">País</Label>
            <Select
              value={draftFilters.pais || 'Todos'}
              onValueChange={(val) => setDraftFilters((prev) => ({ ...prev, pais: val }))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {PAIS_LIST.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Família do Produto */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Família Produto</Label>
            <Select
              value={draftFilters.familia_produto || 'Todos'}
              onValueChange={(val) =>
                setDraftFilters((prev) => ({ ...prev, familia_produto: val }))
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {FAMILIA_PRODUTO_LIST.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Início */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Data Início</Label>
            <Input
              type="date"
              value={draftFilters.data_inicio || ''}
              onChange={(e) =>
                setDraftFilters((prev) => ({ ...prev, data_inicio: e.target.value }))
              }
              className="h-9 text-xs"
            />
          </div>

          {/* Data Fim */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground font-medium">Data Fim</Label>
            <Input
              type="date"
              value={draftFilters.data_fim || ''}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, data_fim: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {!isAllEspecies && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Espécies: {selectedEspecies.join(', ')}
              </Badge>
            )}
            {draftFilters.vendedor && draftFilters.vendedor !== 'Todos' && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Vendedor: {draftFilters.vendedor}
              </Badge>
            )}
            {draftFilters.canal_vendas && draftFilters.canal_vendas !== 'Todos' && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Canal: {draftFilters.canal_vendas}
              </Badge>
            )}
            {draftFilters.pais && draftFilters.pais !== 'Todos' && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                País: {draftFilters.pais}
              </Badge>
            )}
            {draftFilters.familia_produto && draftFilters.familia_produto !== 'Todos' && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Família: {draftFilters.familia_produto}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-9 text-xs gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar Filtros
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onApply}
              disabled={loading}
              className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground font-medium"
            >
              <Filter className="w-3.5 h-3.5" />
              {loading ? 'Aplicando...' : 'Aplicar Filtros'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
