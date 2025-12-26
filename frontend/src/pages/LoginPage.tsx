import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError('Ошибка входа. Проверь email/пароль.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-width-450 rounded-xl bg-white p-8 shadow-sm sm:max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">Вход в систему</h1>
        <p className="mt-1 text-sm text-slate-600">Dayton Truck Repair — локальная версия</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="admin@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Пароль
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="••••••••"
            />
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            aria-label="Login"
          >
            {isLoading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage

