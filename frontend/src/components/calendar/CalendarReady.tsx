import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Booking } from '../../types'

interface CalendarReadyProps {
	from: string
	to: string
	onSelect?: (b: Booking) => void
}

function CalendarReady({ from, to, onSelect }: CalendarReadyProps) {
	const queryClient = useQueryClient()
	const { data, isLoading, isError } = useQuery({
		queryKey: ['calendar-ready', { from, to }],
		queryFn: async () => {
			const res = await api.get<Booking[]>('/api/bookings/ready', {
				params: { from, to },
			})
			return res.data ?? []
		},
	})
	const goneMutation = useMutation({
		mutationFn: async (id: string) => {
			await api.put(`/api/bookings/${id}/gone`)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['calendar-ready'] })
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			queryClient.invalidateQueries({ queryKey: ['agenda'] })
			queryClient.invalidateQueries({ queryKey: ['bay-occupancy'] })
		},
	})
	// Labels now come denormalized from backend (unit_label, bay_name)
	// No technicians in compact tiles

	return (
		<section className='w-48 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm'>
			<h3 className='mb-2 text-sm font-semibold text-emerald-900'>Ready</h3>
			{isLoading ? (
				<p className='text-xs text-emerald-700'>Loading…</p>
			) : isError ? (
				<p className='text-xs text-rose-600'>Failed to load</p>
			) : (data ?? []).length === 0 ? (
				<p className='text-xs text-emerald-700'>No completed bookings</p>
			) : (
				<ul className='grid grid-cols-1 gap-2'>
					{(data ?? []).slice(0, 20).map(item => (
						<div
							key={item.id}
							className='rounded-lg border border-emerald-200 bg-white/80 p-2 hover:bg-emerald-100/40'
						>
							<button
								type='button'
								onClick={() => onSelect?.(item)}
								className='block w-full text-left'
							>
								<div className='flex items-center justify-between'>
									<span className='font-mono text-[11px] text-emerald-900'>
										{item.number || item.id.slice(0, 6)}
									</span>
									<span className='rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800'>
										ready
									</span>
								</div>
								<div className='mt-1 text-[12px] font-medium text-emerald-900'>
									{[item.unit_label, item.bay_name].filter(Boolean).join(' · ')}
								</div>
							</button>
							<div className='mt-2 flex justify-end'>
								<button
									type='button'
									onClick={() => goneMutation.mutate(item.id)}
									className='inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60'
									disabled={goneMutation.isPending}
								>
									<span>Gone</span>
								</button>
							</div>
						</div>
					))}
				</ul>
			)}
		</section>
	)
}

export default CalendarReady
