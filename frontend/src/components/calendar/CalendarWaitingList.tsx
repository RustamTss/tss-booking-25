import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Booking } from '../../types'

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
	// Labels now arrive denormalized (unit_label, bay_name)
	// No technicians in compact tiles

	return (
		<section className='w-48 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm'>
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
				<ul className='grid grid-cols-1 gap-2'>
					{(data ?? []).slice(0, 20).map(item => (
						<button
							key={item.id}
							type='button'
							onClick={() => onSelect?.(item)}
							className='rounded-lg border border-amber-200 bg-white/80 p-2 text-left hover:bg-amber-100/40'
						>
							<div className='flex items-center justify-between'>
								<span className='font-mono text-[11px] text-amber-900'>
									{item.number || item.id.slice(0, 6)}
								</span>
								<span className='rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800'>
									waiting
								</span>
							</div>
							<div className='mt-1 text-[12px] font-medium text-amber-900'>
								{[item.unit_label, item.bay_name].filter(Boolean).join(' · ')}
							</div>
							{item.company_name ? (
								<div className='text-[11px] text-amber-800'>
									{item.company_name}
								</div>
							) : null}
						</button>
					))}
				</ul>
			)}
		</section>
	)
}

export default CalendarWaitingList
