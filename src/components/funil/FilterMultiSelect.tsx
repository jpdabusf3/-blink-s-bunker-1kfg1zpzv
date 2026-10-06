import { useState, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterMultiSelectOption {
  value: string
  label: string
}

export interface FilterMultiSelectProps {
  label: string
  allLabel?: string
  options: (FilterMultiSelectOption | string)[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  triggerClassName?: string
  disabled?: boolean
  maxBadgesInTrigger?: number
  'aria-label'?: string
}

export function FilterMultiSelect({
  label,
  allLabel = `Todos (${label})`,
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder = 'Buscar...',
  className,
  triggerClassName,
  disabled = false,
  maxBadgesInTrigger = 1,
  'aria-label': ariaLabel,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const normalizedOptions: FilterMultiSelectOption[] = useMemo(
    () => options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt)),
    [options],
  )

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions
    const q = search.toLowerCase()
    return normalizedOptions.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
    )
  }, [normalizedOptions, search])

  const isAllSelected = selected.length === 0

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleSelectAll = () => {
    onChange([])
  }

  const handleClear = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    onChange([])
  }

  const handleRemoveSingle = (e: React.MouseEvent, value: string) => {
    e.stopPropagation()
    onChange(selected.filter((v) => v !== value))
  }

  const getOptionLabel = (value: string) => {
    const found = normalizedOptions.find((o) => o.value === value)
    return found ? found.label : value
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel || label}
          disabled={disabled}
          type="button"
          className={cn(
            'h-9 justify-between text-xs font-normal px-2.5 gap-1.5 bg-background shadow-sm hover:bg-muted/50 transition-colors',
            selected.length > 0 && 'border-primary/50 text-foreground font-medium',
            triggerClassName,
            className,
          )}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            {isAllSelected ? (
              <span className="text-muted-foreground truncate">{placeholder || allLabel}</span>
            ) : (
              <div className="flex items-center gap-1 truncate">
                <span className="font-semibold text-primary shrink-0">{label}:</span>
                {selected.slice(0, maxBadgesInTrigger).map((val) => (
                  <Badge
                    key={val}
                    variant="secondary"
                    className="px-1.5 py-0 h-5 text-[11px] font-normal truncate max-w-[110px]"
                    title={getOptionLabel(val)}
                  >
                    <span className="truncate">{getOptionLabel(val)}</span>
                  </Badge>
                ))}
                {selected.length > maxBadgesInTrigger && (
                  <Badge
                    variant="secondary"
                    className="px-1 py-0 h-5 text-[11px] font-mono shrink-0 font-semibold"
                    title={`Mais ${selected.length - maxBadgesInTrigger} selecionado(s)`}
                  >
                    +{selected.length - maxBadgesInTrigger}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    handleClear()
                  }
                }}
                className="text-muted-foreground hover:text-destructive p-0.5 rounded cursor-pointer transition-colors focus:outline-none"
                title={`Limpar filtro de ${label}`}
                aria-label={`Limpar filtro de ${label}`}
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-0 shadow-lg border rounded-lg overflow-hidden"
        align="start"
      >
        {/* Barra de busca */}
        <div className="p-2 border-b bg-muted/30">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8 h-8 text-xs bg-background"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Resumo da seleção e botões de ação rápidos */}
        <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/10 border-b">
          <span>
            {isAllSelected
              ? 'Todos exibidos'
              : `${selected.length} de ${normalizedOptions.length} selecionado(s)`}
          </span>
          <div className="flex items-center gap-2">
            {!isAllSelected && (
              <button
                type="button"
                onClick={() => handleClear()}
                className="hover:underline text-destructive font-medium cursor-pointer"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={handleSelectAll}
              className={cn(
                'hover:underline font-medium cursor-pointer',
                isAllSelected ? 'text-muted-foreground' : 'text-primary',
              )}
            >
              Todos
            </button>
          </div>
        </div>

        {/* Chips ativos no topo do popover caso haja seleção */}
        {selected.length > 0 && (
          <div className="p-2 border-b bg-muted/20 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {selected.map((val) => (
              <Badge
                key={val}
                variant="secondary"
                className="text-[11px] pl-2 pr-1 py-0.5 gap-1 font-medium bg-background border"
              >
                <span className="truncate max-w-[140px]">{getOptionLabel(val)}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveSingle(e, val)}
                  className="rounded-full hover:bg-muted p-0.5 cursor-pointer text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${getOptionLabel(val)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Lista de opções com checkboxes */}
        <div className="p-1 max-h-60 overflow-y-auto space-y-0.5">
          {/* Opção "Todos" */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleSelectAll}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelectAll()
              }
            }}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors',
              isAllSelected
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-muted-foreground',
            )}
          >
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Todos"
            />
            <span className="flex-1 font-medium">{allLabel}</span>
          </div>

          <div className="border-t my-1 border-border/50" />

          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Nenhuma opção encontrada.
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isChecked = selected.includes(opt.value)
              return (
                <div
                  key={opt.value}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggle(opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleToggle(opt.value)
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors',
                    isChecked
                      ? 'bg-primary/10 text-foreground font-medium'
                      : 'hover:bg-muted text-foreground/80',
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(opt.value)}
                    aria-label={opt.label}
                  />
                  <span className="flex-1 truncate">{opt.label}</span>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
