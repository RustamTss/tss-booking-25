import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import TechnicianQuickModal from '../components/quickAddModals/TechnicianQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { Technician } from '../types'

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

	const listQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})

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
				<CreateButton onClick={openCreate}>Create Technician</CreateButton>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data ?? []}
				pageParamKey='technicians'
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
