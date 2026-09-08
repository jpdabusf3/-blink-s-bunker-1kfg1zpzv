import React, { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronsUpDown, Loader2, UserMinus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GestaoTecnica } from '@/services/gestao-tecnica'

export interface EditableMemberSelectProps {
  currentId?: string | null
  currentName?: string | null
  members: GestaoTecnica[]
  onSelect: (memberId: string | null, memberName: string | null) => Promise<void>
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  allowClear?: boolean
}

function formatRoleLabel(funcao?: string) {
  if (!funcao) return 'membro'
  switch (funcao) {
    case 'vendedor':
      return 'vendedor'
    case 'gestor_tecnico':
      return 'gestor técnico'
    case 'gestor_comercial':
      return 'gestor comercial'
    case 'gestor_especie':
      return 'gestor de espécie'
    case 'diretor':
      return 'diretor'
    case 'ceo':
      return 'CEO'
    default:
      return funcao.replace(/_/g, ' ')
  }
}

export function EditableMemberSelect({
  currentId,
  currentName,
  members,
  onSelect,
  disabled = false,
  placeholder = 'Não atribuído',
  searchPlaceholder = 'Buscar membro...',
  emptyText = 'Nenhum membro encontrado.',
  allowClear = true,
}: EditableMemberSelectProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Identificar nome exibido
  const matchedMember = currentId ? members.find((m) => m.id === currentId) : undefined
  const displayName = matchedMember?.nome || currentName?.trim() || null

  const handleChoose = async (newId: string | null, newName: string | null) => {
    // Se selecionou o mesmo, só fecha
    const isSame = (newId === null && !currentId) || (newId !== null && currentId === newId)
    if (isSame) {
      setOpen(false)
      return
    }

    setSaving(true)
    try {
      await onSelect(newId, newName)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(v) => !saving && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || saving}
          aria-label={displayName ? `Atribuído a ${displayName}` : placeholder}
          className={cn(
            'group flex items-center justify-between gap-1.5 px-2 py-1 -mx-2 -my-1 rounded text-left text-sm transition-colors w-full max-w-[200px]',
            'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            disabled && 'pointer-events-none opacity-60',
            saving && 'opacity-70 pointer-events-none',
          )}
        >
          <span
            className={cn(
              'truncate font-normal',
              !displayName && 'text-muted-foreground italic text-xs',
            )}
            title={displayName || placeholder}
          >
            {saving ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin inline" />
                Salvando...
              </span>
            ) : (
              displayName || placeholder
            )}
          </span>
          <ChevronsUpDown className="w-3 h-3 text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9 text-xs" />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup heading="Membros da Gestão Técnica">
              {allowClear && (
                <CommandItem
                  value="__none__"
                  onSelect={() => handleChoose(null, null)}
                  className="flex items-center justify-between text-xs py-2 cursor-pointer text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Nenhum / Desatribuir</span>
                  </span>
                  {!currentId && <Check className="w-3.5 h-3.5 text-primary" />}
                </CommandItem>
              )}
              {members.map((m) => {
                const isSelected = currentId === m.id
                return (
                  <CommandItem
                    key={m.id}
                    value={`${m.nome} ${m.funcao || ''} ${m.carteira || ''}`}
                    onSelect={() => handleChoose(m.id, m.nome)}
                    className="flex items-center justify-between text-xs py-2 cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-medium text-foreground truncate">{m.nome}</span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        {formatRoleLabel(m.funcao)}
                        {m.carteira ? ` • ${m.carteira}` : ''}
                      </span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
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
