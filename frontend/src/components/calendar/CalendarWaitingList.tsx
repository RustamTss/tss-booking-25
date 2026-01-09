import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Bay, Booking, Technician, Vehicle } from '../../types'

interface CalendarWaitingListProps {
	from: string
	to: string
	onSelect?: (b: Booking) => void
}

function CalendarWaitingList({ from, to, onSelect }: CalendarWaitingListProps) {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['calendar-waiting', { from, to }],
		queryFn: async () => {
			const res = await api.get<Booking[]>('/api/bookings/waitinglist', {
				params: { from, to },
			})
			return res.data ?? []
		},
	})
	const vehiclesQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const techsQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})

	return (
		<section className='rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm'>
			<h3 className='mb-2 text-sm font-semibold text-amber-900'>
				Waiting list
			</h3>
			{isLoading ? (
				<p className='text-xs text-amber-800'>Loading…</p>
			) : isError ? (
				<p className='text-xs text-rose-600'>Failed to load</p>
			) : (data ?? []).length === 0 ? (
				<p className='text-xs text-amber-800'>No waiting items</p>
			) : (
				<ul className='space-y-2'>
					{(data ?? []).slice(0, 20).map(item => (
						<button
							key={item.id}
							type='button'
							onClick={() => onSelect?.(item)}
							className='w-full rounded-md border border-amber-200 bg-white/70 px-2 py-1.5 text-left hover:bg-amber-100/40'
						>
							<div className='flex items-center justify-between'>
								<span className='font-mono text-[11px] text-amber-900'>
									{item.number || item.id.slice(0, 6)}
								</span>
								<span className='rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800'>
									waiting
								</span>
							</div>
							<div className='mt-0.5 text-[11px] text-amber-900'>
								{(() => {
									const v = (vehiclesQuery.data ?? []).find(
										vs => vs.id === item.vehicle_id
									)
									const plate = v?.plate || v?.vin || ''
									const bay =
										(baysQuery.data ?? []).find(b => b.id === item.bay_id)
											?.name || ''
									const techNames = (item.technician_ids || [])
										.map(
											id => (techsQuery.data ?? []).find(t => t.id === id)?.name
										)
										.filter(Boolean)
										.join(', ')
									return [techNames, plate, bay].filter(Boolean).join(' · ')
								})()}
							</div>
							<div className='text-[11px] text-amber-900'>
								{new Date(item.start).toLocaleString()}
								{item.end ? ` → ${new Date(item.end).toLocaleString()}` : ''}
							</div>
						</button>
					))}
				</ul>
			)}
		</section>
	)
}

export default CalendarWaitingList
