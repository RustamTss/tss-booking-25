import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import CompanyQuickModal from '../components/quickAddModals/CompanyQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { Company } from '../types'

function CompaniesPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({ name: '', contact: '', phone: '' })

	const listQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})

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
				<CreateButton onClick={openCreate}>Create Company</CreateButton>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data ?? []}
				pageParamKey='companies'
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
