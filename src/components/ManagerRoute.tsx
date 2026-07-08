import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { isManager } from '@/lib/user-scope'

export function ManagerRoute() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isManager(user)) return <Navigate to="/" replace />

  return <Outlet />
}
