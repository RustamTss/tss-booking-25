import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import CustomBadge from '../components/shared/ui/CustomBadge'
import type { AuditLog, Company } from '../types'
import CompanyContactsTab from './CompanyContactsTab'
import CompanyUnitsTab from './CompanyUnitsTab'

export default function CompanyDetailsPage() {
	const { id } = useParams<{ id: string }>()
	const companyQuery = useQuery({
		queryKey: ['company', id],
		queryFn: async () => (await api.get<Company>(`/api/companies/${id}`)).data,
	})
	const logsQuery = useQuery({
		queryKey: ['company-logs', id],
		queryFn: async () =>
			(await api.get<AuditLog[]>(`/api/companies/${id}/logs`)).data,
		enabled: Boolean(id),
	})

	if (companyQuery.isLoading)
		return <p className='text-sm text-slate-600'>Loading...</p>
	const company = companyQuery.data
	if (!company)
		return <p className='text-sm text-rose-600'>Company not found</p>

	const rows = [
		{ label: 'Name', value: company.name },
		{ label: 'Contact', value: company.contact || '—' },
		{ label: 'Phone', value: company.phone || '—' },
		{ label: 'Created', value: new Date(company.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(company.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={company.name}
			subtitle='Company'
			rows={rows}
			tabs={['general', 'contacts', 'units', 'logs']}
			renderContacts={() => {
				if (!id) return null
				return <CompanyContactsTab companyId={id} />
			}}
			renderUnits={() => {
				if (!id) return null
				return <CompanyUnitsTab companyId={id} />
			}}
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
					if (l.action === 'company.created') {
						const name = String((l.meta ?? {})['name'] ?? '')
						return {
							id: l.id,
							type: 'create',
							details: <span>Created company “{name}”.</span>,
							time: new Date(l.created_at).toLocaleString(),
						}
					}
					if (l.action === 'company.updated') {
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
					<CustomTable
						columns={columns}
						data={rows}
						pageParamKey='company_logs'
					/>
				)
			}}
		/>
	)
}
