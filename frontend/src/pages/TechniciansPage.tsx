import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Technician } from '../types'

function TechniciansPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', skills: '', phone: '', email: '' })

  const listQuery = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
  })

  const createMutation = useMutation({
    mutationFn: async () =>
      api.post('/api/technicians', {
        ...form,
        skills: form.skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['technicians'] })
      setForm({ name: '', skills: '', phone: '', email: '' })
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Техники</h1>
        <p className="text-sm text-slate-600">Список и добавление механиков</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Новый техник</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="ФИО"
          />
          <input
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Скиллы через запятую"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Телефон"
          />
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Email"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Сохраняем...' : 'Добавить'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Список</h2>
        {listQuery.isLoading ? <p className="text-sm text-slate-600">Загружаем...</p> : null}
        {listQuery.isError ? <p className="text-sm text-rose-600">Ошибка загрузки</p> : null}
        <div className="mt-3 space-y-2 text-sm">
          {listQuery.data?.map((t) => (
            <div key={t.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">{t.name}</div>
              <div className="text-xs text-slate-600">
                {t.skills.join(', ') || '—'} · {t.phone} · {t.email}
              </div>
            </div>
          ))}
          {listQuery.data?.length === 0 ? <p className="text-sm text-slate-600">Пока нет техников</p> : null}
        </div>
      </div>
    </div>
  )
}

export default TechniciansPage

