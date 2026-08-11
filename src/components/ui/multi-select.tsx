import React, { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export interface MultiSelectOption {
  label: string
  value: string
}

interface MultiSelectProps {
  options: (MultiSelectOption | string)[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = 'Selecione...',
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  const normalizedOptions: MultiSelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt,
  )

  const handleSelect = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const handleRemove = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation()
    onChange(value.filter((v) => v !== optionValue))
  }

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  const handleSelectAll = () => {
    onChange(normalizedOptions.map((o) => o.value))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          type="button"
          className={cn(
            'w-full justify-between h-auto min-h-[40px] px-3 py-1.5 font-normal text-left flex-wrap gap-1 bg-background',
            className,
          )}
        >
          <div className="flex flex-wrap gap-1 items-center max-w-[calc(100%-28px)]">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((val) => {
                const opt = normalizedOptions.find((o) => o.value === val)
                const label = opt ? opt.label : val
                return (
                  <Badge
                    key={val}
                    variant="secondary"
                    className="text-xs px-2 py-0.5 font-medium flex items-center gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  >
                    <span>{label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleRemove(e, val)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          handleRemove(e as unknown as React.MouseEvent, val)
                        }
                      }}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 cursor-pointer transition-colors focus:outline-none"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </Badge>
                )
              })
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {value.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClearAll}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    handleClearAll(e as unknown as React.MouseEvent)
                  }
                }}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer focus:outline-none"
                title="Limpar seleção"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
            <CommandGroup>
              <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
                <span>
                  {value.length} de {normalizedOptions.length} selecionados
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="hover:underline text-primary cursor-pointer font-medium"
                  >
                    Marcar todos
                  </button>
                  {value.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange([])}
                      className="hover:underline text-destructive cursor-pointer font-medium"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              {normalizedOptions.map((option) => {
                const isSelected = value.includes(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check className={cn('h-3 w-3')} />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
