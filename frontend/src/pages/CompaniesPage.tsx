import {
	ArrowDownTrayIcon,
	PencilSquareIcon,
	TrashIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import CompanyQuickModal from '../components/quickAddModals/CompanyQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import useDebounce from '../hooks/useDebounce'
import type { Company, ListResponse } from '../types'

function CompaniesPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({ name: '', contact: '', phone: '' })

	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('companies_page') ?? 1))
	const limit = Math.max(1, Number(search.get('companies_limit') ?? 10))
	const qRaw = search.get('companies_q') ?? ''
	const q = useDebounce(qRaw, 300)

	const listQuery = useQuery<ListResponse<Company>>({
		queryKey: ['companies', page, limit, q],
		queryFn: async () =>
			(
				await api.get<ListResponse<Company>>('/api/companies', {
					params: { envelope: 1, page, limit, q },
				})
			).data,
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('companies_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('companies_limit', String(l))
		next.set('companies_page', '1')
		setSearch(next, { replace: true })
	}
	const handleSetQ = (value: string) => {
		const next = new URLSearchParams(search)
		next.set('companies_q', value)
		next.set('companies_page', '1')
		setSearch(next, { replace: true })
	}

	const createMutation = useMutation({
		mutationFn: async () => api.post('/api/companies', form),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['companies'] })
			setForm({ name: '', contact: '', phone: '' })
			setModalOpen(false)
			success('Company created')
		},
		onError: () => error('Failed to create company'),
	})
	const updateMutation = useMutation({
		mutationFn: async (id: string) => api.put(`/api/companies/${id}`, form),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['companies'] })
			setEditingId(null)
			setModalOpen(false)
			success('Company updated')
		},
		onError: () => error('Failed to update company'),
	})
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/companies/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['companies'] })
			success('Company deleted')
		},
		onError: () => error('Failed to delete company'),
	})

	const openCreate = () => {
		setEditingId(null)
		setForm({ name: '', contact: '', phone: '' })
		setModalOpen(true)
	}
	const openEdit = (c: Company) => {
		setEditingId(c.id)
		setForm({ name: c.name, contact: c.contact, phone: c.phone })
		setModalOpen(true)
	}

	async function handleExport() {
		const params: Record<string, string> = { export: 'csv' }
		if (q) params.q = q
		const res = await api.get('/api/companies', {
			params,
			responseType: 'blob',
		})
		const url = window.URL.createObjectURL(new Blob([res.data]))
		const a = document.createElement('a')
		a.href = url
		a.download = `companies-${Date.now()}.csv`
		document.body.appendChild(a)
		a.click()
		a.remove()
		window.URL.revokeObjectURL(url)
	}

	const columns: Array<Column<Company & { actions?: null }>> = [
		{
			key: 'name',
			header: 'Name',
			render: row => (
				<NavLink to={`/companies/${row.id}`} className='text-sky-600 underline'>
					{row.name}
				</NavLink>
			),
		},
		{
			key: 'company_units_count',
			header: 'Units',
			className: 'w-16 text-right',
			render: row => (
				<span className='inline-block w-12 font-mono text-right'>
					{row.company_units_count ?? 0}
				</span>
			),
		},
		{
			key: 'contact',
			header: 'Contact',
			render: row => <span>{row.contact || '—'}</span>,
		},
		{
			key: 'phone',
			header: 'Phone',
			render: row => <span>{row.phone || '—'}</span>,
		},
		{
			key: 'actions',
			header: 'Actions',
			className: 'w-px',
			render: row => (
				<div className='flex items-center justify-end gap-2'>
					<CustomTooltip content='Edit company'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
							onClick={() => openEdit(row)}
						>
							<PencilSquareIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
					<CustomTooltip content='Delete company'>
						<button
							type='button'
							className='rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50'
							onClick={() => setPendingDeleteId(row.id)}
						>
							<TrashIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
				</div>
			),
		},
	]

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<h1 className='text-xl font-semibold text-slate-900'>
					Companies / clients
				</h1>
				<div className='flex items-center gap-2'>
					<input
						type='text'
						value={qRaw}
						onChange={e => handleSetQ(e.target.value)}
						placeholder='Search companies...'
						className='w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'
					/>
					<button
						type='button'
						onClick={handleExport}
						className='inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800'
						title='Download CSV'
					>
						<ArrowDownTrayIcon className='h-4 w-4' />
						Export
					</button>
					<CreateButton onClick={openCreate}>Create Company</CreateButton>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data?.data ?? []}
				pagination
				pageParamKey='companies'
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

			<CompanyQuickModal
				isOpen={modalOpen}
				mode={editingId ? 'edit' : 'create'}
				isSaving={createMutation.isPending || updateMutation.isPending}
				form={form}
				onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
				onCancel={() => {
					setModalOpen(false)
					setEditingId(null)
				}}
				onSubmit={() =>
					editingId ? updateMutation.mutate(editingId) : createMutation.mutate()
				}
			/>

			<ConfirmDeleteModal
				isOpen={Boolean(pendingDeleteId)}
				onCancel={() => setPendingDeleteId(null)}
				onConfirm={() => {
					if (pendingDeleteId) {
						deleteMutation.mutate(pendingDeleteId)
						setPendingDeleteId(null)
					}
				}}
				title='Delete company'
				message='Are you sure you want to delete this company?'
			/>
		</div>
	)
}

export default CompaniesPage
