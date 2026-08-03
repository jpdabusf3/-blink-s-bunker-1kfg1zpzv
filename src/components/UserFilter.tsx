import { useUsers } from '@/hooks/use-users'
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
}

export function UserFilter({
  value,
  onChange,
  className,
  placeholder = 'Todos os Usuários',
}: UserFilterProps) {
  const { users } = useUsers()

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <User className="w-4 h-4 mr-2 shrink-0" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name || u.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
