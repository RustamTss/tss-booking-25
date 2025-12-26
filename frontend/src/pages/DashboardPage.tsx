import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import type { DashboardSummary } from '../types'

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const res = await api.get<DashboardSummary>('/api/dashboard/summary')
      return res.data
    },
  })

  if (isLoading) {
    return <p className="text-sm text-slate-600">Загружаем дэшборд...</p>
  }
  if (isError || !data) {
    return <p className="text-sm text-rose-600">Не удалось загрузить дэшборд</p>
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Дэшборд занятости</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Открытые брони" value={data.open_bookings} />
        <StatCard label="Брони сегодня" value={data.today_bookings} />
        <StatCard label="Беи" value={data.bays} />
        <StatCard label="Снимок" value={new Date(data.timestamp).toLocaleString()} />
      </div>
    </div>
  )
}

export default DashboardPage

