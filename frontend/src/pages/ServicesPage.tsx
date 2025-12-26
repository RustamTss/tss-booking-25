import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Service } from '../types'

function ServicesPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', description: '', duration_minutes: 60, price: '0' })

  const listQuery = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await api.get<Service[]>('/api/services')).data,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const priceFloat = parseFloat(form.price || '0')
      const payload = {
        name: form.name,
        description: form.description,
        duration_minutes: Number(form.duration_minutes) || 0,
        price_cents: Math.round(priceFloat * 100),
      }
      await api.post('/api/services', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      setForm({ name: '', description: '', duration_minutes: 60, price: '0' })
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Сервисы</h1>
        <p className="text-sm text-slate-600">Создание и просмотр услуг</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Новый сервис</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Название"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Описание"
          />
          <input
            type="number"
            value={form.duration_minutes}
            onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Длительность, мин"
          />
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Цена в $"
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
          {listQuery.data?.map((s) => (
            <div key={s.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-600">{s.description}</p>
                </div>
                <div className="text-right text-xs text-slate-700">
                  <div>${(s.price_cents / 100).toFixed(2)}</div>
                  <div>{s.duration_minutes} мин</div>
                </div>
              </div>
            </div>
          ))}
          {listQuery.data?.length === 0 ? <p className="text-sm text-slate-600">Пока нет сервисов</p> : null}
        </div>
      </div>
    </div>
  )
}

export default ServicesPage

