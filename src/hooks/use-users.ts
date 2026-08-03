import { useState, useEffect } from 'react'
import { getUsers, type UserListItem } from '@/services/users'

export function useUsers() {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { users, loading }
}
