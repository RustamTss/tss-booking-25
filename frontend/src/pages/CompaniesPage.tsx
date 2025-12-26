import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Company } from '../types'

function CompaniesPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', contact: '', phone: '' })

  const listQuery = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
  })

  const createMutation = useMutation({
    mutationFn: async () => api.post('/api/companies', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      setForm({ name: '', contact: '', phone: '' })
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Компании / клиенты</h1>
        <p className="text-sm text-slate-600">Добавление заказчиков</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Новая компания</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Название"
          />
          <input
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Контактное лицо"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Телефон"
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
          {listQuery.data?.map((c) => (
            <div key={c.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">{c.name}</div>
              <div className="text-xs text-slate-600">
                {c.contact} · {c.phone}
              </div>
            </div>
          ))}
          {listQuery.data?.length === 0 ? <p className="text-sm text-slate-600">Пока нет компаний</p> : null}
        </div>
      </div>
    </div>
  )
}

export default CompaniesPage

