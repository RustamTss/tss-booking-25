import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Company, Vehicle } from '../types'

function VehiclesPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    company_id: '',
    type: 'truck',
    vin: '',
    plate: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
  })

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
  })

  const listQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
  })

  const createMutation = useMutation({
    mutationFn: async () => api.post('/api/vehicles', { ...form, year: Number(form.year) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      setForm({
        company_id: '',
        type: 'truck',
        vin: '',
        plate: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
      })
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Транспорт</h1>
        <p className="text-sm text-slate-600">Truck / trailer, привязка к компании</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Новый транспорт</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <select
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Компания</option>
            {companiesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as Vehicle['type'] })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="truck">Truck</option>
            <option value="trailer">Trailer</option>
          </select>
          <input
            value={form.vin}
            onChange={(e) => setForm({ ...form, vin: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="VIN"
          />
          <input
            value={form.plate}
            onChange={(e) => setForm({ ...form, plate: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Plate"
          />
          <input
            value={form.make}
            onChange={(e) => setForm({ ...form, make: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Make"
          />
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Model"
          />
          <input
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Год"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !form.company_id}
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
          {listQuery.data?.map((v) => (
            <div key={v.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-900">
                {v.type.toUpperCase()} · {v.plate} · {v.vin}
              </div>
              <div className="text-xs text-slate-600">
                {v.make} {v.model} {v.year} · company {v.company_id}
              </div>
            </div>
          ))}
          {listQuery.data?.length === 0 ? <p className="text-sm text-slate-600">Пока нет транспорта</p> : null}
        </div>
      </div>
    </div>
  )
}

export default VehiclesPage

