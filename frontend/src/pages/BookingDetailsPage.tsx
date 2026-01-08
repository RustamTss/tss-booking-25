import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import CustomBadge from '../components/shared/ui/CustomBadge'
import type {
	AuditLog,
	Bay,
	Booking,
	Company,
	Technician,
	Vehicle,
} from '../types'

export default function BookingDetailsPage() {
	const { id } = useParams<{ id: string }>()
	const bookingQuery = useQuery({
		queryKey: ['booking', id],
		queryFn: async () => (await api.get<Booking>(`/api/bookings/${id}`)).data,
	})
	const vehiclesQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})
	const techsQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})
	const logsQuery = useQuery({
		queryKey: ['booking-logs', id],
		queryFn: async () =>
			(await api.get<AuditLog[]>(`/api/bookings/${id}/logs`)).data,
		enabled: Boolean(id),
	})

	if (bookingQuery.isLoading)
		return <p className='text-sm text-slate-600'>Loading...</p>
	const b = bookingQuery.data
	if (!b) return <p className='text-sm text-rose-600'>Booking not found</p>

	const vehicleLabel = (() => {
		const v = (vehiclesQuery.data ?? []).find(x => x.id === b.vehicle_id)
		return v?.plate || v?.vin || b.vehicle_id
	})()
	const bayName =
		(baysQuery.data ?? []).find(x => x.id === b.bay_id)?.name || b.bay_id
	const companyName =
		(companiesQuery.data ?? []).find(x => x.id === b.company_id)?.name ||
		b.company_id
	const techNames = (b.technician_ids || [])
		.map(tid => (techsQuery.data ?? []).find(t => t.id === tid)?.name)
		.filter(Boolean)
		.join(', ')

	const rows = [
		{ label: 'Number', value: b.number || b.id.slice(0, 6) },
		{ label: 'Complaint', value: b.complaint || '—' },
		{ label: 'Description', value: b.description || '—' },
		{ label: 'Unit', value: vehicleLabel },
		{ label: 'Bay', value: bayName },
		{ label: 'Company', value: companyName || '—' },
		{ label: 'Technicians', value: techNames || '—' },
		{ label: 'Start', value: new Date(b.start).toLocaleString() },
		{ label: 'End', value: b.end ? new Date(b.end).toLocaleString() : '—' },
		{ label: 'Status', value: b.status },
		{
			label: 'Fullbay Service',
			value: b.fullbay_service_id ? (
				<a
					href={
						(import.meta.env.VITE_FULLBAY_URL as string) ??
						'https://app.fullbay.com'
					}
					target='_blank'
					rel='noreferrer'
					className='text-sky-600 underline'
				>
					{b.fullbay_service_id}
				</a>
			) : (
				'—'
			),
		},
		{ label: 'Created', value: new Date(b.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(b.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={`Booking #${b.number || b.id.slice(0, 6)}`}
			subtitle='Booking'
			rows={rows}
			tabs={['general', 'logs']}
			renderLogs={() => {
				if (logsQuery.isLoading)
					return <p className='text-sm text-slate-600'>Loading logs...</p>
				const logs = logsQuery.data ?? []
				if (logs.length === 0)
					return <p className='text-sm text-slate-600'>No logs yet.</p>
				// Helpers
				const resolveName = (
					type: 'vehicle' | 'bay' | 'company' | 'tech',
					id: string
				) => {
					if (!id) return ''
					if (type === 'vehicle') {
						const v = (vehiclesQuery.data ?? []).find(x => x.id === id)
						return v?.plate || v?.vin || id
					}
					if (type === 'bay')
						return (baysQuery.data ?? []).find(x => x.id === id)?.name || id
					if (type === 'company')
						return (
							(companiesQuery.data ?? []).find(x => x.id === id)?.name || id
						)
					if (type === 'tech')
						return (techsQuery.data ?? []).find(x => x.id === id)?.name || id
					return id
				}
				type Row = {
					id: string
					type: 'create' | 'update' | 'assign' | 'status' | 'other'
					details: React.ReactNode
					time: string
				}
				const rows: Row[] = logs.map(l => {
					if (l.action === 'booking.created') {
						const num = String((l.meta ?? {})['number'] ?? '')
						const unit = resolveName(
							'vehicle',
							String((l.meta ?? {})['vehicle_id'] ?? '')
						)
						const bay = resolveName(
							'bay',
							String((l.meta ?? {})['bay_id'] ?? '')
						)
						const start = String((l.meta ?? {})['start'] ?? '')
						return {
							id: l.id,
							type: 'create',
							details: (
								<span>
									Created booking #{num} for unit {unit} in bay {bay} starting{' '}
									{new Date(start).toLocaleString()}.
								</span>
							),
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'booking.updated') {
						const m = (l.meta ?? {}) as Record<string, unknown>
						const parts: string[] = []
						const addChange = (
							label: string,
							from?: unknown,
							to?: unknown,
							mapFn?: (v: unknown) => string
						) => {
							const fmt = (v: unknown) => (mapFn ? mapFn(v) : String(v ?? ''))
							parts.push(`${label}: “${fmt(from)}” → “${fmt(to)}”`)
						}
						const mv = m['vehicle_id'] as
							| { from?: string; to?: string }
							| undefined
						if (mv)
							addChange('Unit', mv.from, mv.to, v =>
								resolveName('vehicle', String(v))
							)
						const mb = m['bay_id'] as { from?: string; to?: string } | undefined
						if (mb)
							addChange('Bay', mb.from, mb.to, v =>
								resolveName('bay', String(v))
							)
						const mc = m['company_id'] as
							| { from?: string; to?: string }
							| undefined
						if (mc)
							addChange('Company', mc.from, mc.to, v =>
								resolveName('company', String(v))
							)
						const ms = m['start'] as { from?: string; to?: string } | undefined
						if (ms)
							addChange('Start', ms.from, ms.to, v =>
								new Date(String(v)).toLocaleString()
							)
						const me = m['end'] as { from?: string; to?: string } | undefined
						if (me)
							addChange('End', me.from, me.to, v =>
								v ? new Date(String(v)).toLocaleString() : '—'
							)
						const mstatus = m['status'] as
							| { from?: string; to?: string }
							| undefined
						if (mstatus) addChange('Status', mstatus.from, mstatus.to)
						const mcomplaint = m['complaint'] as
							| { from?: string; to?: string }
							| undefined
						if (mcomplaint)
							addChange('Complaint', mcomplaint.from, mcomplaint.to)
						const mdesc = m['description'] as
							| { from?: string; to?: string }
							| undefined
						if (mdesc) addChange('Description', mdesc.from, mdesc.to)
						const added = (m['technicians_added'] as string[] | undefined) ?? []
						const removed =
							(m['technicians_removed'] as string[] | undefined) ?? []
						if (added.length)
							parts.push(
								`Technicians added: ${added
									.map(id => resolveName('tech', id))
									.join(', ')}`
							)
						if (removed.length)
							parts.push(
								`Technicians removed: ${removed
									.map(id => resolveName('tech', id))
									.join(', ')}`
							)
						return {
							id: l.id,
							type: 'update',
							details: <span>Updated {parts.join('; ')}.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'booking.canceled') {
						return {
							id: l.id,
							type: 'status',
							details: <span>Booking canceled.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'booking.closed') {
						return {
							id: l.id,
							type: 'status',
							details: <span>Booking ready.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					return {
						id: l.id,
						type: 'other',
						details: <span>{l.action}</span>,
						time: new Date(l.created_at).toLocaleString(),
					}
				})
				const columns: Array<Column<Row>> = [
					{
						key: 'type',
						header: 'Type',
						className: 'w-px',
						render: r => (
							<CustomBadge
								label={
									r.type === 'create'
										? 'Created'
										: r.type === 'update'
										? 'Updated'
										: r.type === 'assign'
										? 'Assigned'
										: 'Status'
								}
								variant={
									r.type === 'create'
										? 'create'
										: r.type === 'assign'
										? 'assign'
										: 'update'
								}
							/>
						),
					},
					{ key: 'details', header: 'Details', render: r => r.details },
					{
						key: 'time',
						header: 'Time',
						className: 'w-56',
						render: r => (
							<span className='text-xs text-slate-600'>{r.time}</span>
						),
					},
				]
				return (
					<CustomTable
						columns={columns}
						data={rows}
						pageParamKey='booking_logs'
					/>
				)
			}}
		/>
	)
}
