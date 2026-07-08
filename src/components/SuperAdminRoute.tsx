import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { isMasterOrCeo } from '@/lib/user-scope'

export function SuperAdminRoute() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isMasterOrCeo(user)) return <Navigate to="/" replace />

  return <Outlet />
}
