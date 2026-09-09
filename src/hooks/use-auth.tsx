import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  type ReactNode,
} from 'react'
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
  const prevUserRef = useRef<any>(user)

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      const valid = pb.authStore.isValid
      setIsAuthenticated(valid)
      if (!valid || !record) {
        prevUserRef.current = null
        setUser(null)
        return
      }

      // Compara se os campos relevantes do usuário mudaram antes de atualizar o state.
      // Se apenas o token foi renovado no background sem alteração de dados do usuário,
      // mantém a mesma referência para evitar render cascata em todas as abas.
      const prev = prevUserRef.current
      if (
        prev &&
        prev.id === record.id &&
        prev.email === record.email &&
        prev.role === record.role &&
        prev.name === record.name &&
        prev.job_title === record.job_title &&
        prev.geographicArea === record.geographicArea &&
        prev.country === record.country &&
        prev.avatar === record.avatar &&
        prev.deactivated === record.deactivated
      ) {
        return
      }

      prevUserRef.current = record
      setUser(record)
    })

    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then((result: any) => {
          if (result?.record?.deactivated) {
            pb.authStore.clear()
          }
        })
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
      await pb.collection('users').create({
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
      const authResult = (await pb.collection('users').authWithPassword(email, password)) as any
      if (authResult?.record?.deactivated) {
        pb.authStore.clear()
        throw new Error('Esta conta foi desativada. Entre em contato com o administrador.')
      }
      try {
        await pb.send('/backend/v1/check-invitation', { method: 'POST' })
      } catch {
        /* intentionally ignored */
      }
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

  const value = useMemo(
    () => ({ user, isAuthenticated, signUp, signIn, signOut, loading }),
    [user, isAuthenticated, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
