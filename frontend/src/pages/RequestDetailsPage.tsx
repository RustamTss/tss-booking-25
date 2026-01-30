import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomDetailsPage from '../components/shared/layout/CustomDetailsPage'
import type { Request } from '../types'

export default function RequestDetailsPage() {
	const { id } = useParams<{ id: string }>()

	const query = useQuery({
		queryKey: ['request', id],
		queryFn: async () => (await api.get<Request>(`/api/requests/${id}`)).data,
	})

	if (query.isLoading) return <p className='text-sm text-slate-600'>Loading…</p>
	const r = query.data
	if (!r) return <p className='text-sm text-rose-600'>Request not found</p>

	const fmt = (s?: string) => (s && s.trim() ? s : 'Not set')
	const fmtDate = (s?: string) => {
		if (!s) return 'Not set'
		const d = new Date(s)
		return isNaN(d.getTime()) ? 'Not set' : d.toLocaleString()
	}

	const rows = [
		{ label: 'Service Issue', value: fmt(r.service_issue) },
		{ label: 'Driver', value: fmt(r.driver_name) },
		{ label: 'Phone', value: fmt(r.phone) },
		{ label: 'Company', value: fmt(r.company_name) },
		{ label: 'Unit', value: fmt(r.unit_number) },
		{ label: 'Start', value: fmtDate(r.start_at as unknown as string) },
		{ label: 'Status', value: r.status },
		{ label: 'Username', value: fmt(r.username) },
		{ label: 'User ID', value: fmt(r.user_id) },
		{ label: 'Source', value: fmt(r.source) },
		{ label: 'Created', value: new Date(r.created_at).toLocaleString() },
		{ label: 'Updated', value: new Date(r.updated_at).toLocaleString() },
	]

	return (
		<CustomDetailsPage
			title={r.driver_name || 'Request'}
			subtitle='Request'
			rows={rows}
			tabs={['general']} // no logs tab
		/>
	)
}
