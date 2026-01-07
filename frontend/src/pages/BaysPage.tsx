import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import BayQuickModal from '../components/quickAddModals/BayQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import { useAuth } from '../context/AuthContext'
import type { Bay } from '../types'

function BaysPage() {
	const qc = useQueryClient()
	const { role } = useAuth()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({ key: '', name: '' })

	const listQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})

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
				{role === 'admin' && (
					<CreateButton onClick={openCreate}>Create Bay</CreateButton>
				)}
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data ?? []}
				pageParamKey='bays'
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
