import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import CustomBadge from '../components/shared/ui/CustomBadge'
import type { AuditLog, Bay } from '../types'

export default function BayDetailsPage() {
	const { id } = useParams<{ id: string }>()
	const bayQuery = useQuery({
		queryKey: ['bay', id],
		queryFn: async () => (await api.get<Bay>(`/api/bays/${id}`)).data,
	})
	const logsQuery = useQuery({
		queryKey: ['bay-logs', id],
		queryFn: async () =>
			(await api.get<AuditLog[]>(`/api/bays/${id}/logs`)).data,
		enabled: Boolean(id),
	})

	if (bayQuery.isLoading)
		return <p className='text-sm text-slate-600'>Loading...</p>
	const bay = bayQuery.data
	if (!bay) return <p className='text-sm text-rose-600'>Bay not found</p>

	const rows = [
		{ label: 'Name', value: bay.name },
		{ label: 'Key', value: bay.key },
		{ label: 'Created', value: new Date(bay.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(bay.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={bay.name}
			subtitle='Bay'
			rows={rows}
			tabs={['general', 'logs']}
			renderLogs={() => {
				if (logsQuery.isLoading)
					return <p className='text-sm text-slate-600'>Loading logs...</p>
				const logs = logsQuery.data ?? []
				if (logs.length === 0)
					return <p className='text-sm text-slate-600'>No logs yet.</p>
				type Row = {
					id: string
					type: 'create' | 'update' | 'other'
					details: React.ReactNode
					time: string
				}
				const rows: Row[] = logs.map(l => {
					if (l.action === 'bay.created') {
						const name = String((l.meta ?? {})['name'] ?? '')
						const key = String((l.meta ?? {})['key'] ?? '')
						return {
							id: l.id,
							type: 'create',
							details: (
								<span>
									Created bay “{name}” (key {key}).
								</span>
							),
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'bay.updated') {
						const changes = l.meta as Record<
							string,
							{ from?: unknown; to?: unknown }
						>
						const parts = Object.entries(changes).map(
							([k, v]) =>
								`${k}: “${String(v?.from ?? '')}” → “${String(v?.to ?? '')}”`
						)
						return {
							id: l.id,
							type: 'update',
							details: <span>Updated {parts.join(', ')}.</span>,
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
										: r.type
								}
								variant={
									r.type === 'create'
										? 'create'
										: r.type === 'update'
										? 'update'
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
					<CustomTable columns={columns} data={rows} pageParamKey='bay_logs' />
				)
			}}
		/>
	)
}
