import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { TelegramSettings, User, UserRole } from '../types'

const roles: UserRole[] = ['admin', 'dispatcher', 'mechanic', 'client']

function SettingsPage() {
  const qc = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ['settings', 'telegram'],
    queryFn: async () => (await api.get<TelegramSettings>('/api/settings/telegram')).data,
  })
  const [tgForm, setTgForm] = useState({ telegram_token: '', telegram_chat: '' })
  useEffect(() => {
    if (settingsQuery.data) {
      setTgForm({
        telegram_token: settingsQuery.data.telegram_token ?? '',
        telegram_chat: settingsQuery.data.telegram_chat ?? '',
      })
    }
  }, [settingsQuery.data])

  const saveTg = useMutation({
    mutationFn: async () => api.put('/api/settings/telegram', tgForm),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'telegram'] }),
  })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/auth/users')).data,
  })
  const [userForm, setUserForm] = useState({ email: '', password: '', role: 'dispatcher' as UserRole })
  const createUser = useMutation({
    mutationFn: async () => api.post('/auth/users', { ...userForm, status: 'active' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setUserForm({ email: '', password: '', role: 'dispatcher' })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Настройки</h1>
        <p className="text-sm text-slate-600">Telegram уведомления и пользователи</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Telegram</h2>
            <p className="text-xs text-slate-600">Token + chat id для уведомлений</p>
          </div>
          {settingsQuery.data ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Загружено</span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={tgForm.telegram_token}
            onChange={(e) => setTgForm((p) => ({ ...p, telegram_token: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Telegram Bot Token"
          />
          <input
            value={tgForm.telegram_chat}
            onChange={(e) => setTgForm((p) => ({ ...p, telegram_chat: e.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Chat ID"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => saveTg.mutate()}
            disabled={saveTg.isPending}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saveTg.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Пользователи</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Email"
          />
          <input
            type="password"
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Пароль"
          />
          <select
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => createUser.mutate()}
            disabled={createUser.isPending}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {createUser.isPending ? 'Создаем...' : 'Добавить'}
          </button>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {usersQuery.data?.map((u) => (
            <div key={u.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{u.email}</div>
                  <div className="text-xs text-slate-600">{u.role}</div>
                </div>
                <span className="text-xs text-slate-500">{u.status}</span>
              </div>
            </div>
          ))}
          {usersQuery.data?.length === 0 ? <p className="text-sm text-slate-600">Пока нет пользователей</p> : null}
        </div>
      </section>
    </div>
  )
}

export default SettingsPage

