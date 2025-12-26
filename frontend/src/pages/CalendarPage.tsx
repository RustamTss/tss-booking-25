import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar as BigCalendar,
  Views,
  dateFnsLocalizer,
  type SlotInfo,
  type Event as RBCEvent,
  type View,
} from 'react-big-calendar'
// @ts-ignore partial types for addon
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import Modal from 'react-modal'
import { api } from '../api/client'
import type { Bay, Booking, BookingStatus, Company, Service, Technician, Vehicle } from '../types'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'

type ViewMode = 'day' | 'week' | 'month' | 'agenda'

const locales = {
  'en-US': enUS,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

const DnDCalendar = withDragAndDrop(BigCalendar as any)

function computeRange(view: ViewMode) {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  if (view === 'day') {
    end.setDate(end.getDate() + 1)
  } else if (view === 'week') {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() + 7)
  } else if (view === 'month') {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1)
  } else {
    start.setDate(start.getDate() - 7)
    end.setDate(end.getDate() + 30)
  }
  return { from: start.toISOString(), to: end.toISOString() }
}

function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week')
  const [form, setForm] = useState({
    title: '',
    description: '',
    vehicle_id: '',
    service_ids: [] as string[],
    bay_id: '',
    technician_ids: [] as string[],
    company_id: '',
    start: '',
    end: '',
    status: 'open' as BookingStatus,
    notes: '',
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const queryClient = useQueryClient()
  const range = useMemo(() => computeRange(view), [view])

  const [serviceSearch, setServiceSearch] = useState('')
  const [techSearch, setTechSearch] = useState('')
  const servicesQuery = useQuery({ queryKey: ['services'], queryFn: async () => (await api.get<Service[]>('/api/services')).data })
  const baysQuery = useQuery({ queryKey: ['bays'], queryFn: async () => (await api.get<Bay[]>('/api/bays')).data })
  const techsQuery = useQuery({ queryKey: ['technicians'], queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data })
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data })
  const companiesQuery = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/api/companies')).data })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agenda', range],
    queryFn: async () => {
      const res = await api.get<Booking[]>('/api/bookings/agenda', { params: range })
      return res.data
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        company_id: form.company_id || undefined,
        start: new Date(form.start).toISOString(),
        end: form.end ? new Date(form.end).toISOString() : undefined,
      }
      await api.post('/api/bookings', payload)
      setModalOpen(false)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setForm({
        title: '',
        description: '',
        vehicle_id: '',
        service_ids: [],
        bay_id: '',
        technician_ids: [],
        company_id: '',
        start: '',
        end: '',
        status: 'open',
        notes: '',
      })
    },
  })

  const events = useMemo<RBCEvent[]>(() => {
    if (!data) return []
    return data.map((item) => ({
      id: item.id,
      title: item.title,
      start: new Date(item.start),
      end: item.end ? new Date(item.end) : new Date(new Date(item.start).getTime() + 60 * 60 * 1000),
      resource: item,
    }))
  }, [data])

  const handleSlot = (slot: SlotInfo) => {
    setForm((prev) => ({
      ...prev,
      start: slot.start.toISOString().slice(0, 16),
      end: slot.end ? slot.end.toISOString().slice(0, 16) : '',
    }))
    setModalOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Календарь бронирований</h1>
          <p className="text-sm text-slate-600">День/неделя/месяц/agenda с открытыми слотами</p>
        </div>
        <div className="flex items-center gap-2">
          {(['day', 'week', 'month', 'agenda'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                view === mode ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'
              }`}
              aria-label={`Switch to ${mode}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Создать бронирование</h2>
        <p className="text-xs text-slate-500">Двойной клик по календарю проставит даты</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Заголовок"
            aria-label="Заголовок"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Описание"
            aria-label="Описание"
          />
          <select
            value={form.vehicle_id}
            onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Выбрать транспорт</option>
            {vehiclesQuery.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate || v.vin} ({v.type})
              </option>
            ))}
          </select>
          <select
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Без компании</option>
            {companiesQuery.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="space-y-1">
            <input
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Поиск сервисов..."
            />
            <select
              multiple
              value={form.service_ids}
              onChange={(e) => setForm({ ...form, service_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {servicesQuery.data
                ?.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (${(s.price_cents / 100).toFixed(2)})
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <input
              value={techSearch}
              onChange={(e) => setTechSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Поиск механиков..."
            />
            <select
              multiple
              value={form.technician_ids}
              onChange={(e) => setForm({ ...form, technician_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {techsQuery.data
                ?.filter((t) => t.name.toLowerCase().includes(techSearch.toLowerCase()))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <select
            value={form.bay_id}
            onChange={(e) => setForm({ ...form, bay_id: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Бей</option>
            {baysQuery.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (cap {b.capacity})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              aria-label="start datetime"
            />
            <input
              type="datetime-local"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              aria-label="end datetime"
            />
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Примечания / проблемы"
            aria-label="notes"
            rows={2}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            aria-label="Create booking"
          >
            {mutation.isPending ? 'Создаем...' : 'Создать'}
          </button>
        </div>
      </section>

      <section
        className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
          fullscreen ? 'fixed inset-0 z-50 bg-white flex flex-col' : ''
        }`}
        style={fullscreen ? { padding: '16px' } : undefined}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">События ({view})</h2>
            <p className="text-xs text-slate-500">Двойной клик по событию заполняет форму</p>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {fullscreen ? 'Свернуть' : 'Во весь экран'}
          </button>
        </div>
        {isLoading ? <p className="text-sm text-slate-600">Загружаем...</p> : null}
        {isError ? <p className="text-sm text-rose-600">Не удалось загрузить</p> : null}
        <div className="mt-3" style={{ height: fullscreen ? 'calc(100vh - 140px)' : 500 }}>
          <DnDCalendar
            localizer={localizer}
            events={events}
            view={view}
            onView={(v: View) => setView(v as ViewMode)}
            defaultView={Views.WEEK}
            views={[Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA]}
            style={{ height: '100%' }}
            onDoubleClickEvent={(event: RBCEvent) => {
              const booking = event.resource as Booking
              setForm((prev) => ({
                ...prev,
                title: booking.title,
                description: booking.description,
                vehicle_id: booking.vehicle_id,
                company_id: booking.company_id,
                service_ids: booking.service_ids,
                technician_ids: booking.technician_ids,
                bay_id: booking.bay_id,
                start: booking.start.slice(0, 16),
                end: booking.end ? booking.end.slice(0, 16) : '',
                status: booking.status,
                notes: booking.notes,
              }))
            }}
            selectable
            onSelectSlot={handleSlot}
            onEventDrop={async ({ event, start, end }) => {
              const booking = event.resource as Booking
              const startIso = (start instanceof Date ? start : new Date(start)).toISOString()
              const endIso = end ? (end instanceof Date ? end : new Date(end)).toISOString() : undefined
              await api.put(`/api/bookings/${booking.id}`, {
                ...booking,
                start: startIso,
                end: endIso,
              })
              queryClient.invalidateQueries({ queryKey: ['agenda'] })
              queryClient.invalidateQueries({ queryKey: ['bookings'] })
            }}
            onEventResize={async ({ event, start, end }) => {
              const booking = event.resource as Booking
              const startIso = (start instanceof Date ? start : new Date(start)).toISOString()
              const endIso = end ? (end instanceof Date ? end : new Date(end)).toISOString() : undefined
              await api.put(`/api/bookings/${booking.id}`, {
                ...booking,
                start: startIso,
                end: endIso,
              })
              queryClient.invalidateQueries({ queryKey: ['agenda'] })
              queryClient.invalidateQueries({ queryKey: ['bookings'] })
            }}
          />
        </div>
      </section>

      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        ariaHideApp={false}
        className="relative mx-auto mt-10 w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"
        overlayClassName="fixed inset-0 z-50 bg-black/50"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Быстрое бронирование</h3>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Закрыть
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Заголовок"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Описание"
          />
          <select
            value={form.vehicle_id}
            onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Выбрать транспорт</option>
            {vehiclesQuery.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate || v.vin} ({v.type})
              </option>
            ))}
          </select>
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
          <div className="space-y-1">
            <input
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Поиск сервисов..."
            />
            <select
              multiple
              value={form.service_ids}
              onChange={(e) => setForm({ ...form, service_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {servicesQuery.data
                ?.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (${(s.price_cents / 100).toFixed(2)})
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <input
              value={techSearch}
              onChange={(e) => setTechSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Поиск механиков..."
            />
            <select
              multiple
              value={form.technician_ids}
              onChange={(e) => setForm({ ...form, technician_ids: Array.from(e.target.selectedOptions, (o) => o.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {techsQuery.data
                ?.filter((t) => t.name.toLowerCase().includes(techSearch.toLowerCase()))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <select
            value={form.bay_id}
            onChange={(e) => setForm({ ...form, bay_id: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Бей</option>
            {baysQuery.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (cap {b.capacity})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local"
              value={form.start}
              onChange={(e) => setForm({ ...form, start: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Примечания / проблемы"
            rows={2}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {mutation.isPending ? 'Создаем...' : 'Создать'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default CalendarPage

