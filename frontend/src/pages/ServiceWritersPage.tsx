import { ArrowDownTrayIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { getErrorMessage } from '../api/errors'
import ServiceWriterQuickModal from '../components/quickAddModals/ServiceWriterQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import useDebounce from '../hooks/useDebounce'
import type { ListResponse, ServiceWriter } from '../types'

function ServiceWritersPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({
		name: '',
		phone: '',
		email: '',
	})

	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('service_writers_page') ?? 1))
	const limit = Math.max(1, Number(search.get('service_writers_limit') ?? 10))
	const qRaw = search.get('service_writers_q') ?? ''
	const q = useDebounce(qRaw, 300)

	const listQuery = useQuery<ListResponse<ServiceWriter>>({
		queryKey: ['service-writers', page, limit, q],
		queryFn: async () =>
			(
				await api.get<ListResponse<ServiceWriter>>('/api/service-writers', {
					params: { envelope: 1, page, limit, q },
				})
			).data,
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('service_writers_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('service_writers_limit', String(l))
		next.set('service_writers_page', '1')
		setSearch(next, { replace: true })
	}
	const handleSetQ = (value: string) => {
		const next = new URLSearchParams(search)
		next.set('service_writers_q', value)
		next.set('service_writers_page', '1')
		setSearch(next, { replace: true })
	}

	const createMutation = useMutation({
		mutationFn: async () =>
			api.post('/api/service-writers', {
				...form,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['service-writers'] })
			setForm({ name: '', phone: '', email: '' })
			setModalOpen(false)
			success('Service writer created')
		},
		onError: err => error(getErrorMessage(err, 'Failed to create service writer')),
	})

	const updateMutation = useMutation({
		mutationFn: async (id: string) =>
			api.put(`/api/service-writers/${id}`, {
				...form,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['service-writers'] })
			setEditingId(null)
			setModalOpen(false)
			success('Service writer updated')
		},
		onError: err => error(getErrorMessage(err, 'Failed to update service writer')),
	})

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/service-writers/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['service-writers'] })
			success('Service writer deleted')
		},
		onError: err => error(getErrorMessage(err, 'Failed to delete service writer')),
	})

	const openCreate = () => {
		setEditingId(null)
		setForm({ name: '', phone: '', email: '' })
		setModalOpen(true)
	}

	const openEdit = (t: ServiceWriter) => {
		setEditingId(t.id)
		setForm({
			name: t.name,
			phone: t.phone,
			email: t.email,
		})
		setModalOpen(true)
	}

	async function handleExport() {
		const params: Record<string, string> = { export: 'csv' }
		if (q) params.q = q
		const res = await api.get('/api/service-writers', {
			params,
			responseType: 'blob',
		})
		const url = window.URL.createObjectURL(new Blob([res.data]))
		const a = document.createElement('a')
		a.href = url
		a.download = `service-writers-${Date.now()}.csv`
		document.body.appendChild(a)
		a.click()
		a.remove()
		window.URL.revokeObjectURL(url)
	}

	const columns: Array<Column<ServiceWriter & { actions?: null }>> = [
		{
			key: 'name',
			header: 'Name',
			render: row => (
				<NavLink
					to={`/service-writers/${row.id}`}
					className='text-sky-600 underline'
				>
					{row.name}
				</NavLink>
			),
		},
		{
			key: 'phone',
			header: 'Phone',
			render: row => <span>{row.phone}</span>,
		},
		{
			key: 'email',
			header: 'Email',
			render: row => <span>{row.email}</span>,
		},
		{
			key: 'actions',
			header: 'Actions',
			className: 'w-px',
			render: row => (
				<div className='flex items-center justify-end gap-2'>
					<CustomTooltip content='Edit service writer'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
							onClick={() => openEdit(row)}
						>
							<PencilSquareIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
					<CustomTooltip content='Delete service writer'>
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
				<h1 className='text-xl font-semibold text-slate-900'>Service writers</h1>
				<div className='flex items-center gap-2'>
					<input
						type='text'
						value={qRaw}
						onChange={e => handleSetQ(e.target.value)}
						placeholder='Search service writers...'
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
					<CreateButton onClick={openCreate}>Create Service Writer</CreateButton>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data?.data ?? []}
				pagination
				pageParamKey='service_writers'
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

			<ServiceWriterQuickModal
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
				title='Delete service writer'
				message='Are you sure you want to delete this service writer?'
			/>
		</div>
	)
}

export default ServiceWritersPage

