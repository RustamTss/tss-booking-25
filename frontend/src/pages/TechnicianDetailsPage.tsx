import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import CustomBadge from '../components/shared/ui/CustomBadge'
import type { AuditLog, Technician } from '../types'

export default function TechnicianDetailsPage() {
	const { id } = useParams<{ id: string }>()
	const { data, isLoading, isError } = useQuery({
		queryKey: ['technician', id],
		queryFn: async () =>
			(await api.get<Technician>(`/api/technicians/${id}`)).data,
	})
	const logsQuery = useQuery({
		queryKey: ['technician-logs', id],
		queryFn: async () =>
			(await api.get<AuditLog[]>(`/api/technicians/${id}/logs`)).data,
		enabled: Boolean(id),
	})

	if (isLoading) return <p className='text-sm text-slate-600'>Loading...</p>
	if (isError || !data)
		return <p className='text-sm text-rose-600'>Technician not found</p>

	const rows = [
		{ label: 'Name', value: data.name },
		{ label: 'Skills', value: data.skills?.join(', ') || '—' },
		{ label: 'Phone', value: data.phone || '—' },
		{ label: 'Email', value: data.email || '—' },
		{ label: 'Created', value: new Date(data.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(data.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={data.name}
			subtitle='Technician'
			rows={rows}
			tabs={['general', 'logs']}
			renderLogs={() => {
				if (logsQuery.isLoading)
					return <p className='text-sm text-slate-600'>Loading logs...</p>
				const logs = logsQuery.data ?? []
				if (logs.length === 0)
					return <p className='text-sm text-slate-600'>No logs yet.</p>
				const formatValue = (v: unknown) =>
					Array.isArray(v) ? v.join(', ') : String(v ?? '')
				type Row = {
					id: string
					type: 'create' | 'update' | 'assign' | 'other'
					details: React.ReactNode
					time: string
				}
				const rows: Row[] = logs.map(l => {
					if (l.action === 'technician.created') {
						const name = formatValue((l.meta ?? {})['name'])
						return {
							id: l.id,
							type: 'create',
							details: <span>Created technician “{name}”.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'technician.updated') {
						const changes = l.meta as Record<
							string,
							{ from?: unknown; to?: unknown }
						>
						const parts = Object.entries(changes).map(([k, v]) => {
							const from = formatValue(v?.from)
							const to = formatValue(v?.to)
							return `${k}: “${from}” → “${to}”`
						})
						return {
							id: l.id,
							type: 'update',
							details: <span>Updated {parts.join(', ')}.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'booking.assigned') {
						const number = String((l.meta ?? {})['number'] ?? '')
						const bookingId = String((l.meta ?? {})['booking_id'] ?? '')
						return {
							id: l.id,
							type: 'assign',
							details: (
								<span>
									Assigned to booking{' '}
									<a
										href='/bookings'
										className='text-sky-600 underline underline-offset-2'
									>
										#{number || bookingId.slice(-6)}
									</a>
									.
								</span>
							),
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
										: r.type
								}
								variant={
									r.type === 'create'
										? 'create'
										: r.type === 'update'
										? 'update'
										: 'assign'
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
					<CustomTable columns={columns} data={rows} pageParamKey='tech_logs' />
				)
			}}
		/>
	)
}
