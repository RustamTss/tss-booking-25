import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { Booking, Bay, Vehicle } from '../types'

function StatusBadge({ status }: { status: Booking['status'] }) {
  const colors: Record<Booking['status'], string> = {
    open: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    closed: 'bg-emerald-100 text-emerald-800',
    canceled: 'bg-rose-100 text-rose-800',
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>{status}</span>
}

function BookingsPage() {
  const queryClient = useQueryClient()
  const baysQuery = useQuery({ queryKey: ['bays'], queryFn: async () => (await api.get<Bay[]>('/api/bays')).data })
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data })
  const { data, isLoading, isError } = useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const res = await api.get<Booking[]>('/api/bookings')
      return res.data
    },
  })

  const mutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'close' | 'cancel' }) => {
      const path = action === 'close' ? 'close' : 'cancel'
      await api.put(`/api/bookings/${id}/${path}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  })

  if (isLoading) return <p className="text-sm text-slate-600">Загружаем брони...</p>
  if (isError || !data) return <p className="text-sm text-rose-600">Не удалось загрузить брони</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Бронирования</h1>
          <p className="text-sm text-slate-600">Активные и закрытые сессии по беям</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Заголовок</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Бей</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Старт</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Статус</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((booking) => (
              <tr key={booking.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm text-slate-900">
                  <div className="font-medium">{booking.title}</div>
                  <div className="text-xs text-slate-600">{booking.description}</div>
                  <div className="text-xs text-slate-500">
                    ТС:{' '}
                    {vehiclesQuery.data?.find((v) => v.id === booking.vehicle_id)?.plate ??
                      vehiclesQuery.data?.find((v) => v.id === booking.vehicle_id)?.vin ??
                      booking.vehicle_id}
                  </div>
                </td>
                <td className="px-4 py-2 text-sm text-slate-700">
                  {baysQuery.data?.find((b) => b.id === booking.bay_id)?.name ?? booking.bay_id}
                </td>
                <td className="px-4 py-2 text-sm text-slate-700">
                  {new Date(booking.start).toLocaleString()}
                  <div className="text-xs text-slate-500">{booking.end ? `до ${new Date(booking.end).toLocaleString()}` : 'открыто'}</div>
                </td>
                <td className="px-4 py-2 text-sm text-slate-700">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-4 py-2 text-sm text-slate-700">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => mutation.mutate({ id: booking.id, action: 'close' })}
                      className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60"
                      disabled={mutation.isPending}
                    >
                      Закрыть
                    </button>
                    <button
                      type="button"
                      onClick={() => mutation.mutate({ id: booking.id, action: 'cancel' })}
                      className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-60"
                      disabled={mutation.isPending}
                    >
                      Отменить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BookingsPage

