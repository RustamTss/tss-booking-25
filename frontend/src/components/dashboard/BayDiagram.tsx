import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import truckBlue from '../../assets/frontal-truck-blue.png'
import truckRed from '../../assets/frontal-truck-red.png'
import type { Bay } from '../../types'
import FullWidthModal from '../calendar/FullWidthModal'

type Occupancy = Record<
	string,
	{
		id: string
		number: string
		bay_id: string
		vehicle_id: string
		company_id: string
		start: string
		end?: string
		status: string
		complaint?: string
		description?: string
	}
>

// Use provided frontal truck PNGs; keep sizes subtle and consistent
export const Truck = ({ occupied }: { occupied: boolean }) => (
	<img
		src={occupied ? truckBlue : truckRed}
		alt=''
		aria-hidden
		className='h-5 w-auto select-none pointer-events-none'
	/>
)

// (kept for future use if we need dynamic parsing)

// Optional fallback layout blueprint when DB doesn't contain all lanes/slots.
// Provided by the user: Bay1=5, Bay2=7, Bay3=8, Bay4=5, Bay5=4 (assumed).
const FALLBACK_LAYOUT: Record<number, number> = { 1: 5, 2: 7, 3: 8, 4: 5, 5: 4 }

// Fixed geometry for an industrial scheduler look
const BAY_WIDTH = 180 // px
const SLOT_HEIGHT = 88 // px
const TOP_PADDING = 16 // px
const RAIL_THICKNESS = 3 // px
const TRUCK_H = 48 // px (h-12)
const TRUCK_CLASS = 'h-12 w-auto select-none pointer-events-none'
// Per-lane vertical offsets (in slots) to create stepped blueprint structure
const LANE_OFFSET_SLOTS: Record<number, number> = {
	1: 1,
	2: 0,
	3: 0,
	4: 0,
	5: 1,
}
// Per-lane row patterns: number of columns per row (top→bottom).
// Example X / XX / XX -> [1, 2, 2]
const LANE_COLUMNS: Record<number, number[]> = {
	1: [1, 2, 2],
	2: [1, 2, 2, 2],
	3: [2, 2, 2, 2],
	4: [1, 1, 1, 2],
	5: [1, 1, 2],
}
function buildRowsForLane(lane: number, slotCount: number): number[] {
	const base = (LANE_COLUMNS[lane] ?? [1]).slice()
	let cap = base.reduce((a, b) => a + b, 0)
	while (cap < slotCount) {
		const last = base.length > 0 ? base[base.length - 1] : 1
		base.push(last)
		cap += last
	}
	return base
}

export default function BayDiagram() {
	const [fullscreen, setFullscreen] = useState(false)
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const occupancyQuery = useQuery({
		queryKey: ['bay-occupancy'],
		queryFn: async () =>
			(await api.get<{ occupancy: Occupancy }>('/api/bays/occupancy')).data
				.occupancy,
		refetchInterval: 60_000,
	})

	const lanes = useMemo(() => {
		const bays = (baysQuery.data ?? []).slice()
		const bayByName = new Map(bays.map(b => [b.name.toUpperCase(), b]))

		// Build columns using fallback blueprint so all lanes are always visible
		const result: Array<{
			lane: number
			list: Array<Bay | { id: string; name: string }>
		}> = []
		const lanesSorted = Object.keys(FALLBACK_LAYOUT)
			.map(n => Number(n))
			.sort((a, b) => a - b)
		for (const lane of lanesSorted) {
			const count = FALLBACK_LAYOUT[lane]
			const list: Array<Bay | { id: string; name: string }> = []
			for (let pos = 1; pos <= count; pos++) {
				const key = `BAY-${lane}-${pos}`.toUpperCase()
				const existing = bayByName.get(key)
				if (existing) {
					list.push(existing)
				} else {
					// Placeholder slot (no DB record yet)
					list.push({
						id: `placeholder-${lane}-${pos}`,
						name: `BAY-${lane}-${pos}`,
					})
				}
			}
			result.push({ lane, list })
		}
		return result
	}, [baysQuery.data])

	const occupancy = occupancyQuery.data ?? {}

	const renderDiagram = () => (
		<div className='overflow-x-auto'>
			<div className='flex gap-10'>
				{lanes.map(col => {
					const rows = buildRowsForLane(col.lane, col.list.length)
					const height = TOP_PADDING * 2 + rows.length * SLOT_HEIGHT
					const offsetSlots = LANE_OFFSET_SLOTS[col.lane] || 0
					const offsetPx = offsetSlots * SLOT_HEIGHT
					let cursor = 0
					return (
						<div
							key={col.lane}
							className='shrink-0'
							style={{ width: BAY_WIDTH }}
						>
							<div className='mb-2 text-center text-sm font-medium text-slate-700'>
								Bay {col.lane}
							</div>
							<div
								className='relative rounded-lg bg-white'
								style={{ height: height + offsetPx }}
							>
								{/* Rails */}
								<div
									className='absolute left-0 bg-slate-800'
									style={{ width: RAIL_THICKNESS, top: offsetPx, height }}
								/>
								<div
									className='absolute right-0 bg-slate-800'
									style={{ width: RAIL_THICKNESS, top: offsetPx, height }}
								/>
								{/* Row separators and mid rails (for 2 columns) */}
								{rows.map((cols, i) => {
									const rowTop = offsetPx + TOP_PADDING + i * SLOT_HEIGHT
									return (
										<div key={i}>
											{/* horizontal line between rows (skip top) */}
											{i > 0 ? (
												<div
													className='absolute left-0 right-0 bg-slate-300'
													style={{ height: 1, top: rowTop }}
												/>
											) : null}
											{/* mid rail only for two-column rows */}
											{cols === 2 ? (
												<div
													className='absolute bg-slate-800'
													style={{
														width: RAIL_THICKNESS,
														height: SLOT_HEIGHT,
														left: '50%',
														top: rowTop,
														transform: 'translateX(-50%)',
													}}
												/>
											) : null}
										</div>
									)
								})}
								{/* Trucks positioned by row + column */}
								{rows.map((cols, rowIdx) => {
									const topCenter =
										offsetPx +
										TOP_PADDING +
										rowIdx * SLOT_HEIGHT +
										(SLOT_HEIGHT - TRUCK_H) / 2
									const leftPercents = cols === 1 ? [50] : [25, 75]
									return leftPercents.map((pct, j) => {
										if (cursor >= col.list.length) return null
										const bay = col.list[cursor++]
										const occ = occupancy[bay.id]
										const title = occ
											? `#${occ.number}\nUnit: ${occ.vehicle_id}\nCompany: ${
													occ.company_id
											  }\n${new Date(occ.start).toLocaleString()} — ${
													occ.end ? new Date(occ.end).toLocaleString() : 'now'
											  }`
											: 'Empty'
										return (
											<div
												key={`${rowIdx}-${j}`}
												className='absolute'
												style={{
													top: topCenter,
													left: `${pct}%`,
													transform: 'translate(-50%, 0)',
												}}
												title={title}
											>
												<img
													src={occ ? truckBlue : truckRed}
													alt=''
													aria-hidden
													className={TRUCK_CLASS}
												/>
											</div>
										)
									})
								})}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)

	return (
		<section
			className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
			// dotted blueprint grid background
			style={{
				backgroundImage:
					'radial-gradient(rgb(226 232 240) 1px, transparent 1px)',
				backgroundSize: '18px 18px',
			}}
		>
			<div className='mb-3 flex items-center justify-between'>
				<h3 className='text-sm font-semibold text-slate-900'>Bay Diagram</h3>
				<div className='flex items-center gap-3'>
					<p className='text-xs text-slate-500'>
						Blue: occupied · Red: empty (updates every minute)
					</p>
					<button
						type='button'
						onClick={() => setFullscreen(true)}
						className='rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800'
					>
						Full screen
					</button>
				</div>
			</div>
			{renderDiagram()}
			<FullWidthModal
				isOpen={fullscreen}
				onClose={() => setFullscreen(false)}
				title='Bay Diagram'
			>
				<div className='h-full'>{renderDiagram()}</div>
			</FullWidthModal>
		</section>
	)
}
