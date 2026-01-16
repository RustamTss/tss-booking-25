import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import CustomBadge from '../components/shared/ui/CustomBadge'
import type { AuditLog, ServiceWriter } from '../types'

export default function ServiceWriterDetailsPage() {
	const { id } = useParams<{ id: string }>()
	const { data, isLoading, isError } = useQuery({
		queryKey: ['service-writer', id],
		queryFn: async () =>
			(await api.get<ServiceWriter>(`/api/service-writers/${id}`)).data,
	})
	const logsQuery = useQuery({
		queryKey: ['service-writer-logs', id],
		queryFn: async () =>
			(await api.get<AuditLog[]>(`/api/service-writers/${id}/logs`)).data,
		enabled: Boolean(id),
	})

	if (isLoading) return <p className='text-sm text-slate-600'>Loading...</p>
	if (isError || !data)
		return <p className='text-sm text-rose-600'>Service writer not found</p>

	const rows = [
		{ label: 'Name', value: data.name },
		{ label: 'Phone', value: data.phone || '—' },
		{ label: 'Email', value: data.email || '—' },
		{ label: 'Created', value: new Date(data.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(data.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={data.name}
			subtitle='Service writer'
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
					if (l.action === 'service_writer.created') {
						const name = String((l.meta ?? {})['name'] ?? '')
						return {
							id: l.id,
							type: 'create',
							details: <span>Created “{name}”.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'service_writer.updated') {
						const m = l.meta as Record<string, { from?: unknown; to?: unknown }>
						const parts = Object.entries(m).map(([k, v]) => {
							const from = String(v?.from ?? '')
							const to = String(v?.to ?? '')
							return `${k}: “${from}” → “${to}”`
						})
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
								label={r.type === 'create' ? 'Created' : 'Updated'}
								variant={r.type === 'create' ? 'create' : 'update'}
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
					<CustomTable columns={columns} data={rows} pageParamKey='sw_logs' />
				)
			}}
		/>
	)
}
