import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import BayQuickModal from '../components/quickAddModals/BayQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import { useAuth } from '../context/AuthContext'
import type { Bay, ListResponse } from '../types'
import useDebounce from '../hooks/useDebounce'

function BaysPage() {
	const qc = useQueryClient()
	const { role } = useAuth()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({ key: '', name: '' })

	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('bays_page') ?? 1))
	const limit = Math.max(1, Number(search.get('bays_limit') ?? 10))
	const qRaw = search.get('bays_q') ?? ''
	const q = useDebounce(qRaw, 300)

	const listQuery = useQuery<ListResponse<Bay>>({
		queryKey: ['bays', page, limit, q],
		queryFn: async () =>
			(
				await api.get<ListResponse<Bay>>('/api/bays', {
					params: { envelope: 1, page, limit, q },
				})
			).data,
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('bays_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('bays_limit', String(l))
		next.set('bays_page', '1')
		setSearch(next, { replace: true })
	}
	const handleSetQ = (value: string) => {
		const next = new URLSearchParams(search)
		next.set('bays_q', value)
		next.set('bays_page', '1')
		setSearch(next, { replace: true })
	}

	const createMutation = useMutation({
		mutationFn: async () =>
			api.post('/api/bays', {
				key: form.key,
				name: form.name,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['bays'] })
			setForm({ key: '', name: '' })
			setModalOpen(false)
			success('Bay created')
		},
		onError: () => error('Failed to create bay'),
	})
	const updateMutation = useMutation({
		mutationFn: async (id: string) =>
			api.put(`/api/bays/${id}`, {
				key: form.key,
				name: form.name,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['bays'] })
			setEditingId(null)
			setModalOpen(false)
			success('Bay updated')
		},
		onError: () => error('Failed to update bay'),
	})
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/bays/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['bays'] })
			success('Bay deleted')
		},
		onError: () => error('Failed to delete bay'),
	})

	const openCreate = () => {
		setEditingId(null)
		setForm({ key: '', name: '' })
		setModalOpen(true)
	}
	const openEdit = (b: Bay) => {
		setEditingId(b.id)
		setForm({ key: b.key, name: b.name })
		setModalOpen(true)
	}

	const columns: Array<Column<Bay & { actions?: null }>> = [
		{
			key: 'name',
			header: 'Name',
			render: row => (
				<NavLink to={`/bays/${row.id}`} className='text-sky-600 underline'>
					{row.name}
				</NavLink>
			),
		},
		{ key: 'key', header: 'Key' },
		{
			key: 'actions',
			header: 'Actions',
			className: 'w-px',
			render: row => (
				<div className='flex items-center justify-end gap-2'>
					{role === 'admin' && (
						<>
							<CustomTooltip content='Edit bay'>
								<button
									type='button'
									className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
									onClick={() => openEdit(row)}
								>
									<PencilSquareIcon className='h-4 w-4' />
								</button>
							</CustomTooltip>
							<CustomTooltip content='Delete bay'>
								<button
									type='button'
									className='rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50'
									onClick={() => setPendingDeleteId(row.id)}
								>
									<TrashIcon className='h-4 w-4' />
								</button>
							</CustomTooltip>
						</>
					)}
				</div>
			),
		},
	]

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<h1 className='text-xl font-semibold text-slate-900'>Bays</h1>
				<div className='flex items-center gap-2'>
					<input
						type='text'
						value={qRaw}
						onChange={e => handleSetQ(e.target.value)}
						placeholder='Search bays...'
						className='w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'
					/>
					{role === 'admin' && (
						<CreateButton onClick={openCreate}>Create Bay</CreateButton>
					)}
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data?.data ?? []}
				pagination
				pageParamKey='bays'
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

			{role === 'admin' && (
				<BayQuickModal
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
						editingId
							? updateMutation.mutate(editingId)
							: createMutation.mutate()
					}
				/>
			)}

			{role === 'admin' && (
				<ConfirmDeleteModal
					isOpen={Boolean(pendingDeleteId)}
					onCancel={() => setPendingDeleteId(null)}
					onConfirm={() => {
						if (pendingDeleteId) {
							deleteMutation.mutate(pendingDeleteId)
							setPendingDeleteId(null)
						}
					}}
					title='Delete bay'
					message='Are you sure you want to delete this bay?'
				/>
			)}
		</div>
	)
}

export default BaysPage
