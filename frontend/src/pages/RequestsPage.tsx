import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import CustomSelect, { type Option } from '../components/shared/CustomSelect'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import type { ListResponse, Request, RequestStatus } from '../types'

const statusOpts: Option<string>[] = [
	{ label: 'All', value: '' },
	{ label: 'new', value: 'new' },
	{ label: 'in_review', value: 'in_review' },
	{ label: 'approved', value: 'approved' },
	{ label: 'rejected', value: 'rejected' },
]

export default function RequestsPage() {
	const qc = useQueryClient()
	const [status, setStatus] = useState<string>('')
	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('requests_page') ?? 1))
	const limit = Math.max(1, Number(search.get('requests_limit') ?? 10))

	const listQuery = useQuery<ListResponse<Request>>({
		queryKey: ['requests', { status }, page, limit],
		queryFn: async () => {
			const params: Record<string, string | number> = { envelope: 1, page, limit }
			if (status) params.status = status
			const res = await api.get<ListResponse<Request>>('/api/requests', { params })
			return res.data
		},
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('requests_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('requests_limit', String(l))
		next.set('requests_page', '1')
		setSearch(next, { replace: true })
	}

	const update = useMutation({
		mutationFn: async ({ id, next }: { id: string; next: RequestStatus }) =>
			api.put(`/api/requests/${id}`, { status: next }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
	})

	const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data])

	const columns: Array<Column<Request & { actions?: null }>> = [
		{ key: 'company_name', header: 'Company' },
		{ key: 'driver_name', header: 'Driver' },
		{ key: 'phone', header: 'Phone' },
		{ key: 'unit_number', header: 'Unit' },
		{
			key: 'start_at',
			header: 'Start',
			render: r => <span>{new Date(r.start_at).toLocaleString()}</span>,
		},
		{
			key: 'status',
			header: 'Status',
			render: r => (
				<span className='rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'>
					{r.status}
				</span>
			),
		},
		{
			key: 'actions',
			header: 'Actions',
			render: r => (
				<div className='flex flex-wrap gap-2'>
					<button
						type='button'
						onClick={() => update.mutate({ id: r.id, next: 'in_review' })}
						className='rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-60'
						disabled={update.isPending}
					>
						Review
					</button>
					<button
						type='button'
						onClick={() => update.mutate({ id: r.id, next: 'approved' })}
						className='rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60'
						disabled={update.isPending}
					>
						Approve
					</button>
					<button
						type='button'
						onClick={() => update.mutate({ id: r.id, next: 'rejected' })}
						className='rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-60'
						disabled={update.isPending}
					>
						Reject
					</button>
				</div>
			),
		},
	]

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-xl font-semibold text-slate-900'>Requests</h1>
					<p className='text-sm text-slate-600'>Incoming service requests</p>
				</div>
				<div className='w-40'>
					<CustomSelect
						options={statusOpts}
						value={statusOpts.find(o => o.value === status) ?? statusOpts[0]}
						onChange={o => setStatus(o.value)}
					/>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={rows}
				pagination
				pageParamKey='requests'
				serverPagination={
					listQuery.data?.pagination
						? {
								total: listQuery.data.pagination.total,
								page: listQuery.data.pagination.page,
								limit: listQuery.data.pagination.limit,
								totalPages: listQuery.data.pagination.totalPages,
								hasNextPage: listQuery.data.pagination.hasNextPage,
								hasPrevPage: listQuery.data.pagination.hasPrevPage,
								onPageChange: handleSetPage,
								onLimitChange: handleSetLimit,
						  }
						: undefined
				}
			/>
		</div>
	)
}

