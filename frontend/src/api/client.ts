import axios from 'axios'

export const AUTH_KEY = 'tss_auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8090',
})

let currentToken: string | undefined

function loadPersistedToken(): string | undefined {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { token?: string }
    return parsed.token
  } catch {
    return undefined
  }
}

export function setAuthToken(token?: string) {
  currentToken = token
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }
  delete api.defaults.headers.common.Authorization
}

const persisted = loadPersistedToken()
if (persisted) {
  setAuthToken(persisted)
}

api.interceptors.request.use((config) => {
  if (!config.headers?.Authorization && currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      // сброс токена и редирект на логин
      setAuthToken()
      localStorage.removeItem(AUTH_KEY)
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export { api }

