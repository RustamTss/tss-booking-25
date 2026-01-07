import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import UserQuickModal from '../components/quickAddModals/UserQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { User, UserRole } from '../types'

const roles: UserRole[] = ['admin', 'office']

function UsersPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState<{
		email: string
		password: string
		role: UserRole
		status: 'active' | 'inactive'
	}>({
		email: '',
		password: '',
		role: 'office' as UserRole,
		status: 'active',
	})

	const listQuery = useQuery({
		queryKey: ['users'],
		queryFn: async () => (await api.get<User[]>('/auth/users')).data,
	})

	const createMutation = useMutation({
		mutationFn: async () => api.post('/auth/users', form),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['users'] })
			setForm({ email: '', password: '', role: 'office', status: 'active' })
			setModalOpen(false)
			success('User created')
		},
		onError: () => error('Failed to create user'),
	})

	const updateMutation = useMutation({
		mutationFn: async (id: string) =>
			api.put(`/auth/users/${id}`, {
				email: form.email,
				role: form.role,
				status: form.status,
				password: form.password || undefined,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['users'] })
			setEditingId(null)
			setModalOpen(false)
			success('User updated')
		},
		onError: () => error('Failed to update user'),
	})

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/auth/users/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['users'] })
			success('User deleted')
		},
		onError: () => error('Failed to delete user'),
	})

	const openCreate = () => {
		setEditingId(null)
		setForm({ email: '', password: '', role: 'office', status: 'active' })
		setModalOpen(true)
	}
	const openEdit = (u: User) => {
		setEditingId(u.id)
		setForm({
			email: u.email,
			password: '',
			role: u.role,
			status: (u.status as 'active' | 'inactive') ?? 'active',
		})
		setModalOpen(true)
	}

	const columns: Array<Column<User & { actions?: null }>> = [
		{
			key: 'email',
			header: 'Email',
			render: row => (
				<NavLink to={`/users/${row.id}`} className='text-sky-600 underline'>
					{row.email}
				</NavLink>
			),
		},
		{
			key: 'role',
			header: 'Role',
			render: row => <span className='capitalize'>{row.role}</span>,
		},
		{
			key: 'status',
			header: 'Status',
			render: row => <span className='capitalize'>{row.status}</span>,
		},
		{
			key: 'actions',
			header: 'Actions',
			className: 'w-px',
			render: row => (
				<div className='flex items-center justify-end gap-2'>
					<CustomTooltip content='Edit user'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
							onClick={() => openEdit(row)}
						>
							<PencilSquareIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
					<CustomTooltip content='Delete user'>
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
				<h1 className='text-xl font-semibold text-slate-900'>Users</h1>
				<CreateButton onClick={openCreate}>Create User</CreateButton>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data ?? []}
				pageParamKey='users'
			/>

			<UserQuickModal
				isOpen={modalOpen}
				mode={editingId ? 'edit' : 'create'}
				isSaving={createMutation.isPending || updateMutation.isPending}
				form={form}
				roles={roles}
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
				title='Delete user'
				message='Are you sure you want to delete this user?'
			/>
		</div>
	)
}

export default UsersPage
