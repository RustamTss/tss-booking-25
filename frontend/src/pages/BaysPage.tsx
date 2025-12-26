import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Bay } from '../types'

function BaysPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', capacity: 3 })

  const listQuery = useQuery({
    queryKey: ['bays'],
    queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
  })

  const createMutation = useMutation({
    mutationFn: async () => api.post('/api/bays', { ...form, capacity: Number(form.capacity) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bays'] })
      setForm({ name: '', capacity: 3 })
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Беи</h1>
        <p className="text-sm text-slate-600">Вместимость до 3 машин</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Новый бей</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Название бэя"
          />
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            min={1}
            max={3}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Вместимость (1-3)"
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
          {listQuery.data?.map((b) => (
            <div key={b.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">{b.name}</div>
              <div className="text-xs text-slate-600">Capacity: {b.capacity}</div>
            </div>
          ))}
          {listQuery.data?.length === 0 ? <p className="text-sm text-slate-600">Пока нет бэев</p> : null}
        </div>
      </div>
    </div>
  )
}

export default BaysPage

