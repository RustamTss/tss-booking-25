import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import CustomBadge from '../components/shared/ui/CustomBadge'
import type { AuditLog, Company, Vehicle } from '../types'

export default function UnitDetailsPage() {
	const { id } = useParams<{ id: string }>()
	const unitQuery = useQuery({
		queryKey: ['vehicle', id],
		queryFn: async () => (await api.get<Vehicle>(`/api/vehicles/${id}`)).data,
	})
	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})
	const logsQuery = useQuery({
		queryKey: ['vehicle-logs', id],
		queryFn: async () =>
			(await api.get<AuditLog[]>(`/api/vehicles/${id}/logs`)).data,
		enabled: Boolean(id),
	})

	if (unitQuery.isLoading)
		return <p className='text-sm text-slate-600'>Loading...</p>
	const unit = unitQuery.data
	if (!unit) return <p className='text-sm text-rose-600'>Unit not found</p>
	const companyName =
		(companiesQuery.data ?? []).find(c => c.id === unit.company_id)?.name ||
		unit.company_id

	const rows = [
		{ label: 'Company', value: companyName },
		{ label: 'Type', value: unit.type.toUpperCase() },
		{ label: 'VIN', value: unit.vin || '—' },
		{ label: 'Plate', value: unit.plate || '—' },
		{ label: 'Make', value: unit.make || '—' },
		{ label: 'Model', value: unit.model || '—' },
		{ label: 'Year', value: String(unit.year) },
		{ label: 'Created', value: new Date(unit.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(unit.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={unit.plate || unit.vin || 'Unit'}
			subtitle='Unit'
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
					if (l.action === 'vehicle.created') {
						const plate = String((l.meta ?? {})['plate'] ?? '')
						const vin = String((l.meta ?? {})['vin'] ?? '')
						return {
							id: l.id,
							type: 'create',
							details: <span>Created unit “{plate || vin}”.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'vehicle.updated') {
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
					<CustomTable columns={columns} data={rows} pageParamKey='unit_logs' />
				)
			}}
		/>
	)
}
