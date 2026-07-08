import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'

interface AuthContextType {
  user: any
  isAuthenticated: boolean
  signUp: (
    email: string,
    password: string,
    jobTitle: string,
    geographicArea: string,
    country: string,
  ) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(pb.authStore.isValid ? pb.authStore.record : null)
  const [isAuthenticated, setIsAuthenticated] = useState(pb.authStore.isValid)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(pb.authStore.isValid ? record : null)
      setIsAuthenticated(pb.authStore.isValid)
    })

    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setLoading(false)
    }
    return () => {
      unsubscribe()
    }
  }, [])

  const signUp = async (
    email: string,
    password: string,
    jobTitle: string,
    geographicArea: string,
    country: string,
  ) => {
    try {
      await pb
        .collection('users')
        .create({
          email,
          password,
          passwordConfirm: password,
          job_title: jobTitle,
          geographicArea,
          country,
        })
      await pb.collection('users').authWithPassword(email, password)
      try {
        await pb.send('/backend/v1/log-activity', {
          method: 'POST',
          body: JSON.stringify({ action: 'Signed Up', details: email }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        /* intentionally ignored */
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      try {
        await pb.send('/backend/v1/log-activity', {
          method: 'POST',
          body: JSON.stringify({ action: 'Logged In', details: email }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        /* intentionally ignored */
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, signUp, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
