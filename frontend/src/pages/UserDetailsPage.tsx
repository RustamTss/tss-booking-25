import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import CustomBadge from '../components/shared/ui/CustomBadge'
import type { AuditLog, User } from '../types'

export default function UserDetailsPage() {
	const { id } = useParams<{ id: string }>()
	const userQuery = useQuery({
		queryKey: ['user', id],
		queryFn: async () => (await api.get<User>(`/auth/users/${id}`)).data,
	})
	const logsQuery = useQuery({
		queryKey: ['user-logs', id],
		queryFn: async () =>
			(await api.get<AuditLog[]>(`/auth/users/${id}/logs`)).data,
		enabled: Boolean(id),
	})

	if (userQuery.isLoading)
		return <p className='text-sm text-slate-600'>Loading...</p>
	const user = userQuery.data
	if (!user) return <p className='text-sm text-rose-600'>User not found</p>

	const rows = [
		{ label: 'Email', value: user.email },
		{ label: 'Role', value: user.role },
		{ label: 'Status', value: user.status },
		{ label: 'Created', value: new Date(user.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(user.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={user.email}
			subtitle='User'
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
					if (l.action === 'user.created') {
						const email = String((l.meta ?? {})['email'] ?? '')
						return {
							id: l.id,
							type: 'create',
							details: <span>Created user “{email}”.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'user.updated') {
						const changes = l.meta as Record<
							string,
							{ from?: unknown; to?: unknown }
						>
						const parts = Object.entries(changes).map(([k, v]) => {
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
					<CustomTable columns={columns} data={rows} pageParamKey='user_logs' />
				)
			}}
		/>
	)
}
