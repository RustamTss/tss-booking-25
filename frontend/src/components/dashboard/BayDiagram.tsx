import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../../api/client'
import truckBlue from '../../assets/frontal-truck-blue.png'
import truckGreen from '../../assets/frontal-truck-green.png'
import truckOrange from '../../assets/frontal-truck-orange.png'
// red icon no longer used for available state; keep imports minimal
import truckGray from '../../assets/frontal-truck-gray.png'
import type { Bay, Booking, Company, Technician, Vehicle } from '../../types'
import FullWidthModal from '../calendar/FullWidthModal'
import BookingQuickModal from '../quickAddModals/BookingQuickModal'
import CustomTooltip from '../shared/ui/CustomTooltip'

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
export const Truck = ({
	color,
}: {
	color: 'available' | 'open' | 'ready' | 'waiting'
}) => {
	const src =
		color === 'available'
			? truckGray
			: color === 'open'
			? truckBlue
			: color === 'ready'
			? truckGreen
			: truckOrange
	const ring =
		color === 'open'
			? 'ring-2 ring-sky-500 bg-sky-50'
			: color === 'ready'
			? 'ring-2 ring-emerald-500 bg-emerald-50'
			: color === 'waiting'
			? 'ring-2 ring-orange-400 bg-orange-50'
			: 'ring-2 ring-slate-400 bg-slate-50'
	return (
		<div
			className={`relative z-10 inline-flex items-center justify-center rounded-full p-1.5 ${ring}`}
		>
			<img
				src={src}
				alt=''
				aria-hidden
				className='h-12 w-auto select-none pointer-events-none'
			/>
			{color === 'available' ? (
				<span className='absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-white'>
					+
				</span>
			) : null}
		</div>
	)
}

// Explicit blueprint based on provided map
// Grid: 4 columns (Left OB | Col2 | Col3 | Col4)
// Rows top→bottom match the uploaded diagram
const BLUEPRINT: Array<Array<string | null>> = [
	// Bay 5 row
	['OB-5', 'Bay-5-3', 'Bay-5-2', 'Bay-5-1'],
	// Bay 4 row
	['OB-4', 'Bay-4-3', 'Bay-4-2', 'Bay-4-1'],
	// Inner between 3-4
	[null, 'IB(3-4)-3', 'IB(3-4)-2', 'IB(3-4)-1'],
	// Bay 3 row
	['OB-3', 'Bay-3-2', 'Bay-3-1', 'Alignment-Rack'],
	// Inner between 2-3
	[null, 'IB(2-3)-1', null, null],
	// Bay 2 row
	['OB-2', 'Bay-2-2', 'Bay-2-1', 'Body-Shop'],
	// Inner between 1-2
	[null, 'IB(1-2)-1', null, null],
	// Bay 1 row
	['OB-1', 'Bay-1-2', 'Bay-1-1', null],
]

export default function BayDiagram() {
	const queryClient = useQueryClient()
	const [fullscreen, setFullscreen] = useState(false)
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const techsQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})
	const vehiclesQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})
	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})
	const occupancyQuery = useQuery({
		queryKey: ['bay-occupancy'],
		queryFn: async () =>
			(await api.get<{ occupancy: Occupancy }>('/api/bays/occupancy')).data
				.occupancy,
		refetchInterval: 60_000,
	})
	// Ready within today window
	const readyQuery = useQuery({
		queryKey: ['calendar-ready-diagram'],
		queryFn: async () => {
			const now = new Date()
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
			const end = new Date(start)
			end.setDate(end.getDate() + 1)
			const res = await api.get<Booking[]>('/api/bookings/ready', {
				params: { from: start.toISOString(), to: end.toISOString() },
			})
			return res.data
		},
		refetchInterval: 60_000,
	})
	// Waiting list (unlimited)
	const waitingQuery = useQuery({
		queryKey: ['calendar-waiting-diagram'],
		queryFn: async () => {
			const res = await api.get<Booking[]>('/api/bookings/waitinglist')
			return res.data
		},
		refetchInterval: 60_000,
	})

	const bayByName = useMemo(() => {
		const map = new Map<string, Bay>()
		for (const b of baysQuery.data ?? []) {
			map.set(b.name, b)
		}
		return map
	}, [baysQuery.data])

	const occupancy = occupancyQuery.data ?? {}
	const readyByBay = useMemo(() => {
		const set = new Set<string>()
		for (const r of readyQuery.data ?? []) {
			if (r.bay_id) set.add(r.bay_id)
		}
		return set
	}, [readyQuery.data])

	const getStatusForBay = (
		bayName: string | null
	): 'available' | 'open' | 'ready' => {
		if (!bayName) return 'available'
		const bay = bayByName.get(bayName)
		if (!bay) return 'available'
		if (occupancy[bay.id]) return 'open'
		if (readyByBay.has(bay.id)) return 'ready'
		return 'available'
	}

	// Modal state to edit booking
	const [editing, setEditing] = useState<Booking | null>(null)
	const [modalOpen, setModalOpen] = useState(false)
	const [form, setForm] = useState({
		complaint: '',
		description: '',
		fullbay_service_id: '',
		vehicle_id: '',
		bay_id: '',
		technician_ids: [] as string[],
		company_id: '',
		start: '',
		end: '',
		status: 'open' as Booking['status'],
		notes: '',
	})
	const formatForInput = (d: Date) => {
		const pad = (n: number) => String(n).padStart(2, '0')
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
			d.getDate()
		)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
	}
	const openModalForBooking = (b: Booking) => {
		setEditing(b)
		setForm({
			complaint: b.complaint || '',
			description: b.description,
			fullbay_service_id: b.fullbay_service_id || '',
			vehicle_id: b.vehicle_id,
			bay_id: b.bay_id,
			technician_ids: b.technician_ids || [],
			company_id: b.company_id,
			start: formatForInput(new Date(b.start)),
			end: b.end ? formatForInput(new Date(b.end)) : '',
			status: b.status,
			notes: b.notes || '',
		})
		setModalOpen(true)
	}
	const openCreateForBay = (bayId: string) => {
		setEditing(null)
		const now = new Date()
		setForm({
			complaint: '',
			description: '',
			fullbay_service_id: '',
			vehicle_id: '',
			bay_id: bayId,
			technician_ids: [],
			company_id: '',
			start: formatForInput(now),
			end: '',
			status: 'open',
			notes: '',
		})
		setModalOpen(true)
	}
	// Map occupancy lite record into Booking shape (minimal)
	const toBookingFromOcc = (bayName: string): Booking | null => {
		const bay = bayByName.get(bayName)
		if (!bay) return null
		const o = occupancy[bay.id]
		if (!o) return null
		return {
			id: o.id,
			title: '',
			complaint: o.complaint,
			number: o.number,
			description: o.description || '',
			vehicle_id: o.vehicle_id,
			fullbay_service_id: '',
			bay_id: o.bay_id,
			technician_ids: [],
			company_id: o.company_id,
			start: o.start,
			end: o.end,
			status: (o.status as Booking['status']) || 'open',
			notes: '',
			created_by: '',
			created_at: o.start,
			updated_at: o.start,
		}
	}

	const renderCell = (name: string | null) => {
		if (!name) return <div />
		const bay = bayByName.get(name)
		const status = getStatusForBay(name)
		const isInner = name.startsWith('IB(')
		const showLine = isInner
		const label = name
		const occ = bay ? occupancy[bay.id] : undefined
		let tooltip = label
		if (status === 'open' && occ) {
			tooltip = `#${occ.number} • ${label}\nStart: ${new Date(
				occ.start
			).toLocaleString()}`
		} else if (status === 'ready' && bay) {
			const rb = (readyQuery.data ?? []).find(x => x.bay_id === bay.id)
			if (rb) {
				const when = rb.end
					? new Date(rb.end).toLocaleString()
					: new Date(rb.start).toLocaleString()
				tooltip = `#${rb.number || rb.id} • ${label}\nReady: ${when}`
			}
		} else if (status === 'available') {
			tooltip = `Available • ${label}\nClick to create booking`
		}
		const handleClick = () => {
			if (!bay) return
			if (status === 'open') {
				const b = toBookingFromOcc(name)
				if (b) openModalForBooking(b)
			} else if (status === 'ready') {
				const b = (readyQuery.data ?? []).find(x => x.bay_id === bay.id)
				if (b) openModalForBooking(b)
			} else if (status === 'available') {
				openCreateForBay(bay.id)
			}
		}
		return (
			<div className='relative flex items-center justify-center'>
				{showLine ? (
					<div className='absolute left-0 right-0 top-1/2 z-0 h-px -translate-y-1/2 bg-slate-400' />
				) : null}
				<button
					type='button'
					onClick={handleClick}
					className='flex flex-col items-center gap-1 focus:outline-none'
				>
					<CustomTooltip content={tooltip}>
						<div>
							<Truck color={status} />
						</div>
					</CustomTooltip>
					<span className='rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700'>
						{label}
					</span>
				</button>
			</div>
		)
	}

	const renderDiagram = (fullscreen = false) => {
		return (
			<div className='flex flex-col gap-4 lg:flex-row'>
				{/* Waiting List box on the left (smaller) */}
				<div className='w-56 shrink-0 rounded-lg border border-slate-200 bg-white p-3'>
					<div className='mb-3 text-sm font-semibold text-slate-900'>
						Waiting List
					</div>
					<div className='flex flex-col gap-2'>
						{(waitingQuery.data ?? []).map(b => (
							<button
								type='button'
								key={b.id}
								onClick={() => openModalForBooking(b)}
								className='flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-2.5 py-2 shadow-sm transition hover:shadow-md'
							>
								<CustomTooltip
									content={`${b.unit_label || b.vehicle_id} • ${
										b.company_name || ''
									}`}
								>
									<div>
										<Truck color='waiting' />
									</div>
								</CustomTooltip>
								<span className='text-xs font-medium text-slate-700'>
									{b.unit_label || 'Unit'}
								</span>
							</button>
						))}
						{(waitingQuery.data ?? []).length === 0 ? (
							<p className='text-xs text-slate-500'>No waiting trucks</p>
						) : null}
					</div>
				</div>
				{/* Blueprint grid */}
				<div className='min-w-0 flex-1 overflow-x-auto'>
					<div
						className={`rounded-lg border border-slate-200 bg-white ${
							fullscreen ? 'p-4' : 'p-3'
						}`}
						style={{
							backgroundImage:
								'radial-gradient(rgb(226 232 240) 1px, transparent 1px)',
							backgroundSize: '18px 18px',
						}}
					>
						<div
							className='grid'
							style={{
								gap: fullscreen ? '12px' : '16px',
								gridTemplateColumns: fullscreen
									? 'repeat(4, minmax(180px, 1fr))'
									: 'repeat(4, 200px)',
								maxWidth: fullscreen ? '1200px' : undefined,
								margin: '0 auto',
							}}
						>
							{BLUEPRINT.map((row, i) => (
								<div key={i} className='contents'>
									{row.map((cell, j) => (
										<div
											key={`${i}-${j}`}
											className={`${
												fullscreen ? 'h-20' : 'h-20'
											} w-[200px] place-content-center`}
										>
											{renderCell(cell)}
										</div>
									))}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		)
	}

	const updateMutation = useMutation({
		mutationFn: async () => {
			if (!editing) return
			const payload = {
				complaint: form.complaint || undefined,
				description: form.description,
				fullbay_service_id: form.fullbay_service_id || undefined,
				vehicle_id: form.vehicle_id,
				bay_id: form.bay_id,
				technician_ids: form.technician_ids,
				company_id: form.company_id || undefined,
				start: new Date(form.start).toISOString(),
				end: form.end ? new Date(form.end).toISOString() : undefined,
				// keep status as-is
				notes: form.notes || '',
			}
			await api.put(`/api/bookings/${editing.id}`, payload)
		},
		onSuccess: () => {
			setModalOpen(false)
			// refresh diagram data
			queryClient.invalidateQueries({ queryKey: ['bay-occupancy'] })
			queryClient.invalidateQueries({ queryKey: ['calendar-ready-diagram'] })
			queryClient.invalidateQueries({ queryKey: ['calendar-waiting-diagram'] })
		},
	})
	const createMutation = useMutation({
		mutationFn: async () => {
			const payload = {
				complaint: form.complaint || undefined,
				description: form.description,
				fullbay_service_id: form.fullbay_service_id || undefined,
				vehicle_id: form.vehicle_id,
				bay_id: form.bay_id,
				technician_ids: form.technician_ids,
				company_id: form.company_id || undefined,
				start: new Date(form.start).toISOString(),
				end: form.end ? new Date(form.end).toISOString() : undefined,
				status: form.status,
				notes: form.notes || '',
			}
			await api.post('/api/bookings', payload)
		},
		onSuccess: () => {
			setModalOpen(false)
			queryClient.invalidateQueries({ queryKey: ['bay-occupancy'] })
			queryClient.invalidateQueries({ queryKey: ['calendar-ready-diagram'] })
			queryClient.invalidateQueries({ queryKey: ['calendar-waiting-diagram'] })
		},
	})

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
					<div className='flex items-center gap-3 text-xs text-slate-600'>
						<span className='inline-flex items-center gap-1'>
							<span className='inline-block h-3 w-3 rounded-full ring-2 ring-sky-500 bg-sky-50' />
							<span>Open (blue)</span>
						</span>
						<span className='inline-flex items-center gap-1'>
							<span className='inline-block h-3 w-3 rounded-full ring-2 ring-emerald-500 bg-emerald-50' />
							<span>Ready (green)</span>
						</span>
						<span className='inline-flex items-center gap-1'>
							<span className='inline-block h-3 w-3 rounded-full ring-2 ring-orange-400 bg-orange-50' />
							<span>Waiting (orange)</span>
						</span>
						<span className='inline-flex items-center gap-1'>
							<span className='inline-block h-3 w-3 rounded-full ring-2 ring-slate-400 bg-slate-50' />
							<span>Available (gray)</span>
						</span>
					</div>
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
				<div className='h-full overflow-auto p-4'>{renderDiagram(true)}</div>
			</FullWidthModal>
			<BookingQuickModal
				isOpen={modalOpen}
				isSaving={editing ? updateMutation.isPending : createMutation.isPending}
				isEdit={Boolean(editing)}
				form={form}
				units={(vehiclesQuery.data ?? []).map(v => ({
					id: v.id,
					label:
						(v.plate || v.vin || `${v.make} ${v.model}`) +
						(v.company_name ? ` (${v.company_name})` : ''),
					company_id: v.company_id,
					company_name: v.company_name,
				}))}
				bays={(baysQuery.data ?? []).map(b => ({ id: b.id, label: b.name }))}
				companies={(companiesQuery.data ?? []).map(c => ({
					id: c.id,
					label: c.name,
				}))}
				technicians={(techsQuery.data ?? []).map(t => ({
					id: t.id,
					label: t.name,
				}))}
				onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
				onCancel={() => {
					setModalOpen(false)
				}}
				onSubmit={() =>
					editing ? updateMutation.mutate() : createMutation.mutate()
				}
			/>
		</section>
	)
}
