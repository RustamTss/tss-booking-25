import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setAuthToken } from '../api/client'
import type { UserRole } from '../types'

interface AuthState {
  token?: string
  role?: UserRole
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_KEY = 'tss_auth'

function loadPersisted(): AuthState {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as AuthState
  } catch {
    return {}
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadPersisted())

  useEffect(() => {
    if (state.token) {
      setAuthToken(state.token)
    }
  }, [state.token])

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; role: UserRole }>('/auth/login', { email, password })
    setAuthToken(data.token)
    const next: AuthState = { token: data.token, role: data.role }
    setState(next)
    localStorage.setItem(AUTH_KEY, JSON.stringify(next))
  }

  const logout = () => {
    setAuthToken()
    setState({})
    localStorage.removeItem(AUTH_KEY)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.token),
      login,
      logout,
    }),
    [state],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider missing')
  return ctx
}

