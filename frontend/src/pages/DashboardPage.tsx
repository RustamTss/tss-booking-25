import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
	Area,
	AreaChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts'
import { api } from '../api/client'
import BayDiagram from '../components/dashboard/BayDiagram'
import type { Booking, DashboardSummary } from '../types'

function StatCard({ label, value }: { label: string; value: number | string }) {
	return (
		<div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
			<p className='text-sm text-slate-600'>{label}</p>
			<p className='mt-2 text-2xl font-semibold text-slate-900'>{value}</p>
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
	const bookingsQuery = useQuery({
		queryKey: ['bookings'],
		queryFn: async () => (await api.get<Booking[]>('/api/bookings')).data,
	})

	const series = useMemo(() => {
		const items = bookingsQuery.data ?? []
		const map = new Map<string, number>()
		const days = 14
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date()
			d.setDate(d.getDate() - i)
			const key = d.toISOString().slice(0, 10)
			map.set(key, 0)
		}
		for (const b of items) {
			const key = new Date(b.start).toISOString().slice(0, 10)
			if (map.has(key)) map.set(key, (map.get(key) || 0) + 1)
		}
		return Array.from(map.entries()).map(([date, count]) => ({ date, count }))
	}, [bookingsQuery.data])

	const statusData = useMemo(() => {
		const items = bookingsQuery.data ?? []
		const grouped: Record<string, number> = {}
		for (const b of items) grouped[b.status] = (grouped[b.status] || 0) + 1
		return Object.entries(grouped).map(([name, value]) => ({ name, value }))
	}, [bookingsQuery.data])

	if (isLoading) {
		return <p className='text-sm text-slate-600'>Loading dashboard...</p>
	}
	if (isError || !data) {
		return <p className='text-sm text-rose-600'>Failed to load dashboard</p>
	}

	return (
		<div className='space-y-4'>
			<h1 className='text-xl font-semibold text-slate-900'>Dashboard</h1>
			<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
				<StatCard label='Open bookings' value={data.open_bookings} />
				<StatCard label='Bookings today' value={data.today_bookings} />
				<StatCard label='Bays' value={data.bays} />
				<StatCard
					label='Snapshot'
					value={new Date(data.timestamp).toLocaleString()}
				/>
			</div>
			<div className='grid gap-4 lg:grid-cols-2'>
				<div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
					<p className='mb-2 text-sm font-medium text-slate-900'>
						Bookings last 14 days
					</p>
					<div className='h-64'>
						<ResponsiveContainer width='100%' height='100%'>
							<AreaChart
								data={series}
								margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
							>
								<CartesianGrid strokeDasharray='3 3' />
								<XAxis dataKey='date' tick={{ fontSize: 12 }} />
								<YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
								<Tooltip />
								<Area
									type='monotone'
									dataKey='count'
									stroke='#2563eb'
									fill='#93c5fd'
									fillOpacity={0.2}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
				<div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
					<p className='mb-2 text-sm font-medium text-slate-900'>
						Bookings by status
					</p>
					<div className='h-64'>
						<ResponsiveContainer width='100%' height='100%'>
							<PieChart>
								<Pie dataKey='value' data={statusData} label>
									{statusData.map((_, i) => (
										<Cell
											key={i}
											fill={['#22c55e', '#f97316', '#ef4444', '#0ea5e9'][i % 4]}
										/>
									))}
								</Pie>
								<Tooltip />
								<Legend />
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>
			<BayDiagram />
			{data.top ? (
				<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
					{[
						{ title: 'Top technicians', rows: data.top.technicians },
						{ title: 'Top units', rows: data.top.units },
						{ title: 'Top customers', rows: data.top.companies },
						{ title: 'Top bays', rows: data.top.bays },
					].map(block => (
						<div
							key={block.title}
							className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'
						>
							<div className='border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900'>
								{block.title}
							</div>
							<div className='px-4 py-2'>
								<table className='min-w-full text-left text-sm'>
									<thead>
										<tr className='text-xs uppercase text-slate-500'>
											<th className='py-2'>Name</th>
											<th className='py-2 text-right'>Count</th>
										</tr>
									</thead>
									<tbody>
										{block.rows?.slice(0, 5).map(r => (
											<tr key={r.id} className='border-t border-slate-100'>
												<td className='py-2 pr-3'>
													{block.title === 'Top technicians' ? (
														<NavLink
															to={`/technicians/${r.id}`}
															className='text-sky-600 underline'
														>
															{r.name || r.id}
														</NavLink>
													) : (
														<span>{r.name || r.id}</span>
													)}
												</td>
												<td className='py-2 text-right font-medium'>
													{r.count}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					))}
				</div>
			) : null}
		</div>
	)
}

export default DashboardPage
