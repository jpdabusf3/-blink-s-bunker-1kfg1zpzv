import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { isSuperAdmin } from '@/lib/user-scope'

export function SuperAdminRoute() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isSuperAdmin(user)) return <Navigate to="/" replace />

  return <Outlet />
}
