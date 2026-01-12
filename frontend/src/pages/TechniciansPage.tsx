import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import TechnicianQuickModal from '../components/quickAddModals/TechnicianQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { ListResponse, Technician } from '../types'
import useDebounce from '../hooks/useDebounce'

function TechniciansPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({
		name: '',
		skills: '',
		phone: '',
		email: '',
	})

	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('technicians_page') ?? 1))
	const limit = Math.max(1, Number(search.get('technicians_limit') ?? 10))
	const qRaw = search.get('technicians_q') ?? ''
	const q = useDebounce(qRaw, 300)

	const listQuery = useQuery<ListResponse<Technician>>({
		queryKey: ['technicians', page, limit, q],
		queryFn: async () =>
			(
				await api.get<ListResponse<Technician>>('/api/technicians', {
					params: { envelope: 1, page, limit, q },
				})
			).data,
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('technicians_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('technicians_limit', String(l))
		next.set('technicians_page', '1')
		setSearch(next, { replace: true })
	}
	const handleSetQ = (value: string) => {
		const next = new URLSearchParams(search)
		next.set('technicians_q', value)
		next.set('technicians_page', '1')
		setSearch(next, { replace: true })
	}

	const createMutation = useMutation({
		mutationFn: async () =>
			api.post('/api/technicians', {
				...form,
				skills: form.skills
					.split(',')
					.map(s => s.trim())
					.filter(Boolean),
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['technicians'] })
			setForm({ name: '', skills: '', phone: '', email: '' })
			setModalOpen(false)
			success('Technician created')
		},
		onError: () => error('Failed to create technician'),
	})

	const updateMutation = useMutation({
		mutationFn: async (id: string) =>
			api.put(`/api/technicians/${id}`, {
				...form,
				skills: form.skills
					.split(',')
					.map(s => s.trim())
					.filter(Boolean),
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['technicians'] })
			setEditingId(null)
			setModalOpen(false)
			success('Technician updated')
		},
		onError: () => error('Failed to update technician'),
	})

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/technicians/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['technicians'] })
			success('Technician deleted')
		},
		onError: () => error('Failed to delete technician'),
	})

	const openCreate = () => {
		setEditingId(null)
		setForm({ name: '', skills: '', phone: '', email: '' })
		setModalOpen(true)
	}

	const openEdit = (t: Technician) => {
		setEditingId(t.id)
		setForm({
			name: t.name,
			skills: t.skills.join(', '),
			phone: t.phone,
			email: t.email,
		})
		setModalOpen(true)
	}

	const columns: Array<Column<Technician & { actions?: null }>> = [
		{
			key: 'name',
			header: 'Name',
			render: row => (
				<NavLink
					to={`/technicians/${row.id}`}
					className='text-sky-600 underline'
				>
					{row.name}
				</NavLink>
			),
		},
		{
			key: 'skills',
			header: 'Skills',
			render: row => <span>{row.skills.join(', ') || '—'}</span>,
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
					<CustomTooltip content='Edit technician'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
							onClick={() => openEdit(row)}
						>
							<PencilSquareIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
					<CustomTooltip content='Delete technician'>
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
				<h1 className='text-xl font-semibold text-slate-900'>Technicians</h1>
				<div className='flex items-center gap-2'>
					<input
						type='text'
						value={qRaw}
						onChange={e => handleSetQ(e.target.value)}
						placeholder='Search technicians...'
						className='w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'
					/>
					<CreateButton onClick={openCreate}>Create Technician</CreateButton>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data?.data ?? []}
				pagination
				pageParamKey='technicians'
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

			<TechnicianQuickModal
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
				title='Delete technician'
				message='Are you sure you want to delete this technician?'
			/>
		</div>
	)
}

export default TechniciansPage
