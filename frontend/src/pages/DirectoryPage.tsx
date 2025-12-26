import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Bay, Company, Service, Technician, Vehicle } from '../types'

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

function DirectoryPage() {
  const qc = useQueryClient()

  const [serviceForm, setServiceForm] = useState({ name: '', description: '', duration_minutes: 60, price_cents: 0 })
  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await api.get<Service[]>('/api/services')
      return res.data
    },
  })
  const createService = useMutation({
    mutationFn: async () => api.post('/api/services', serviceForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      setServiceForm({ name: '', description: '', duration_minutes: 60, price_cents: 0 })
    },
  })

  const [techForm, setTechForm] = useState({ name: '', skills: '', phone: '', email: '' })
  const techniciansQuery = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
  })
  const createTech = useMutation({
    mutationFn: async () =>
      api.post('/api/technicians', { ...techForm, skills: techForm.skills.split(',').map((v) => v.trim()).filter(Boolean) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['technicians'] })
      setTechForm({ name: '', skills: '', phone: '', email: '' })
    },
  })

  const [bayForm, setBayForm] = useState({ name: '', capacity: 1 })
  const baysQuery = useQuery({
    queryKey: ['bays'],
    queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
  })
  const createBay = useMutation({
    mutationFn: async () => api.post('/api/bays', bayForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bays'] })
      setBayForm({ name: '', capacity: 1 })
    },
  })

  const [companyForm, setCompanyForm] = useState({ name: '', contact: '', phone: '' })
  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
  })
  const createCompany = useMutation({
    mutationFn: async () => api.post('/api/companies', companyForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      setCompanyForm({ name: '', contact: '', phone: '' })
    },
  })

  const [vehicleForm, setVehicleForm] = useState({
    company_id: '',
    type: 'truck',
    vin: '',
    plate: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
  })
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
  })
  const createVehicle = useMutation({
    mutationFn: async () => api.post('/api/vehicles', vehicleForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] })
      setVehicleForm({
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
      <h1 className="text-xl font-semibold text-slate-900">Справочники</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Сервисы">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={serviceForm.name}
              onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Название"
            />
            <input
              value={serviceForm.description}
              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Описание"
            />
            <input
              type="number"
              value={serviceForm.duration_minutes}
              onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Длительность (мин)"
            />
            <input
              type="number"
              value={serviceForm.price_cents}
              onChange={(e) => setServiceForm({ ...serviceForm, price_cents: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Цена, центы"
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Всего: {servicesQuery.data?.length ?? 0}</span>
            <button
              type="button"
              onClick={() => createService.mutate()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              Добавить
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {servicesQuery.data?.map((s) => (
              <div key={s.id} className="rounded-md bg-slate-50 px-3 py-2">
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-600">
                  {s.description} · {s.duration_minutes} мин · ${(s.price_cents / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Техники">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={techForm.name}
              onChange={(e) => setTechForm({ ...techForm, name: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="ФИО"
            />
            <input
              value={techForm.skills}
              onChange={(e) => setTechForm({ ...techForm, skills: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Скиллы через запятую"
            />
            <input
              value={techForm.phone}
              onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Телефон"
            />
            <input
              value={techForm.email}
              onChange={(e) => setTechForm({ ...techForm, email: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Email"
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Всего: {techniciansQuery.data?.length ?? 0}</span>
            <button
              type="button"
              onClick={() => createTech.mutate()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              Добавить
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {techniciansQuery.data?.map((t) => (
              <div key={t.id} className="rounded-md bg-slate-50 px-3 py-2">
                <div className="font-medium text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-600">
                  {t.skills.join(', ') || '—'} · {t.phone} · {t.email}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Беи">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={bayForm.name}
              onChange={(e) => setBayForm({ ...bayForm, name: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Название"
            />
            <input
              type="number"
              value={bayForm.capacity}
              onChange={(e) => setBayForm({ ...bayForm, capacity: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Вместимость"
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Всего: {baysQuery.data?.length ?? 0}</span>
            <button
              type="button"
              onClick={() => createBay.mutate()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              Добавить
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {baysQuery.data?.map((b) => (
              <div key={b.id} className="rounded-md bg-slate-50 px-3 py-2">
                <div className="font-medium text-slate-900">{b.name}</div>
                <div className="text-xs text-slate-600">Вместимость: {b.capacity}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Компании/клиенты">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Название компании"
            />
            <input
              value={companyForm.contact}
              onChange={(e) => setCompanyForm({ ...companyForm, contact: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Контактное лицо"
            />
            <input
              value={companyForm.phone}
              onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Телефон"
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Всего: {companiesQuery.data?.length ?? 0}</span>
            <button
              type="button"
              onClick={() => createCompany.mutate()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              Добавить
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {companiesQuery.data?.map((c) => (
              <div key={c.id} className="rounded-md bg-slate-50 px-3 py-2">
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-600">
                  {c.contact} · {c.phone}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Транспорт (truck/trailer)">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={vehicleForm.company_id}
              onChange={(e) => setVehicleForm({ ...vehicleForm, company_id: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="company_id"
            />
            <select
              value={vehicleForm.type}
              onChange={(e) => setVehicleForm({ ...vehicleForm, type: e.target.value as Vehicle['type'] })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="truck">Truck</option>
              <option value="trailer">Trailer</option>
            </select>
            <input
              value={vehicleForm.vin}
              onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="VIN"
            />
            <input
              value={vehicleForm.plate}
              onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Plate"
            />
            <input
              value={vehicleForm.make}
              onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Make"
            />
            <input
              value={vehicleForm.model}
              onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Model"
            />
            <input
              type="number"
              value={vehicleForm.year}
              onChange={(e) => setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Год"
            />
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Всего: {vehiclesQuery.data?.length ?? 0}</span>
            <button
              type="button"
              onClick={() => createVehicle.mutate()}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            >
              Добавить
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {vehiclesQuery.data?.map((v) => (
              <div key={v.id} className="rounded-md bg-slate-50 px-3 py-2">
                <div className="font-medium text-slate-900">
                  {v.type.toUpperCase()} · {v.plate} · {v.vin}
                </div>
                <div className="text-xs text-slate-600">
                  {v.make} {v.model} {v.year} · company {v.company_id}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export default DirectoryPage

