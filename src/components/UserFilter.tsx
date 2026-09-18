import { useState, useEffect, useMemo } from 'react'
import { useUsers } from '@/hooks/use-users'
import { getGestaoTecnica, type GestaoTecnica } from '@/services/gestao-tecnica'
import { buildUnifiedVendedoresList, type UnifiedVendedorOption } from '@/lib/vendedorFilterHelper'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User } from 'lucide-react'

interface UserFilterProps {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  /** Se informado, repassa a lista unificada de vendedores ao componente pai */
  onOptionsLoaded?: (options: UnifiedVendedorOption[]) => void
}

export function UserFilter({
  value,
  onChange,
  className,
  placeholder = 'Todos os Vendedores',
  onOptionsLoaded,
}: UserFilterProps) {
  const { users } = useUsers()
  const [gestaoMembers, setGestaoMembers] = useState<GestaoTecnica[]>([])

  useEffect(() => {
    getGestaoTecnica()
      .then(setGestaoMembers)
      .catch(() => {})
  }, [])

  const options = useMemo(() => {
    return buildUnifiedVendedoresList(gestaoMembers, users)
  }, [gestaoMembers, users])

  useEffect(() => {
    if (onOptionsLoaded) {
      onOptionsLoaded(options)
    }
  }, [options, onOptionsLoaded])

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <User className="w-4 h-4 mr-2 shrink-0" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
