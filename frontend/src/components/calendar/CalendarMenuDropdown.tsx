import { Menu } from '@headlessui/react'
import type { Event as RBCEvent } from 'react-big-calendar'
import type { Booking } from '../../types'
import CustomMenuDropdown from './CustomMenuDropdown'

type Props = {
	open: boolean
	rect: DOMRect | null
	events: RBCEvent[]
	onClose: () => void
	onSelect: (booking: Booking) => void
}

export default function CalendarMenuDropdown({
	open,
	rect,
	events,
	onClose,
	onSelect,
}: Props) {
	const hhmm = (d: Date) =>
		`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
			2,
			'0'
		)}`

	return (
		<CustomMenuDropdown
			open={open}
			anchorRect={rect}
			onClose={onClose}
			title='Day events'
			width={320}
		>
			{events.map((evt, idx) => {
				const b = evt.resource as Booking
				const s = evt.start as Date
				const e = (evt.end as Date) || new Date(s.getTime() + 3600000)
				return (
					<Menu.Item key={`${b.id}-${idx}`}>
						{({ active }) => (
							<button
								type='button'
								className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left ${
									active ? 'bg-slate-50' : ''
								}`}
								onClick={() => onSelect(b)}
							>
								<div className='min-w-0 flex-1'>
									<div className='truncate text-sm font-medium text-slate-900'>
										{evt.title as string}
									</div>
									<div className='text-xs text-slate-500'>
										{hhmm(s)} — {hhmm(e)}
									</div>
								</div>
								<span className='shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600'>
									{b.number || b.id.slice(0, 6)}
								</span>
							</button>
						)}
					</Menu.Item>
				)
			})}
			{events.length === 0 ? (
				<div className='p-2 text-center text-xs text-slate-500'>No events</div>
			) : null}
		</CustomMenuDropdown>
	)
}
