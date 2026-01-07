import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import CustomInput from '../components/shared/CustomInput'
import CustomModal from '../components/shared/CustomModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { Contact } from '../types'

export default function CompanyContactsTab({
	companyId,
}: {
	companyId: string
}) {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const listQuery = useQuery({
		queryKey: ['company-contacts', companyId],
		queryFn: async () =>
			(await api.get<Contact[]>(`/api/companies/${companyId}/contacts`)).data,
	})
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({ name: '', phone: '', email: '' })

	const createMutation = useMutation({
		mutationFn: async () =>
			api.post(`/api/companies/${companyId}/contacts`, form),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['company-contacts', companyId] })
			setForm({ name: '', phone: '', email: '' })
			setModalOpen(false)
			success('Contact created')
		},
		onError: () => error('Failed to create contact'),
	})
	const updateMutation = useMutation({
		mutationFn: async (id: string) => api.put(`/api/contacts/${id}`, form),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['company-contacts', companyId] })
			setEditingId(null)
			setModalOpen(false)
			success('Contact updated')
		},
		onError: () => error('Failed to update contact'),
	})
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/contacts/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['company-contacts', companyId] })
			setPendingDeleteId(null)
			success('Contact deleted')
		},
		onError: () => error('Failed to delete contact'),
	})

	type Row = Contact & { actions?: null }
	const columns: Array<Column<Row>> = [
		{ key: 'name', header: 'Name' },
		{ key: 'phone', header: 'Phone' },
		{ key: 'email', header: 'Email' },
		{
			key: 'actions',
			header: 'Actions',
			className: 'w-px',
			render: r => (
				<div className='flex items-center justify-end gap-2'>
					<CustomTooltip content='Edit contact'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
							onClick={() => {
								setEditingId(r.id)
								setForm({ name: r.name, phone: r.phone, email: r.email || '' })
								setModalOpen(true)
							}}
						>
							<PencilSquareIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
					<CustomTooltip content='Delete contact'>
						<button
							type='button'
							className='rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50'
							onClick={() => setPendingDeleteId(r.id)}
						>
							<TrashIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
				</div>
			),
		},
	]

	return (
		<div className='space-y-3'>
			<div className='flex items-center justify-between'>
				<h3 className='text-sm font-semibold text-slate-900'>Contacts</h3>
				<CreateButton
					onClick={() => {
						setEditingId(null)
						setForm({ name: '', phone: '', email: '' })
						setModalOpen(true)
					}}
				>
					Create Contact
				</CreateButton>
			</div>
			<CustomTable
				columns={columns}
				data={listQuery.data ?? []}
				pageParamKey='company_contacts'
			/>
			<CustomModal
				isOpen={modalOpen}
				onClose={() => {
					setModalOpen(false)
					setEditingId(null)
				}}
				title={editingId ? 'Update contact' : 'Create contact'}
			>
				<div className='grid gap-3'>
					<CustomInput
						label='Name'
						value={form.name}
						onChange={v => setForm(f => ({ ...f, name: v }))}
					/>
					<div className='grid grid-cols-2 gap-3'>
						<CustomInput
							label='Phone'
							value={form.phone}
							onChange={v => setForm(f => ({ ...f, phone: v }))}
						/>
						<CustomInput
							label='Email'
							value={form.email}
							onChange={v => setForm(f => ({ ...f, email: v }))}
						/>
					</div>
					<div className='flex justify-end gap-2 pt-2'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
							onClick={() => {
								setModalOpen(false)
								setEditingId(null)
							}}
						>
							Cancel
						</button>
						<button
							type='button'
							className='rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60'
							disabled={createMutation.isPending || updateMutation.isPending}
							onClick={() =>
								editingId
									? updateMutation.mutate(editingId)
									: createMutation.mutate()
							}
						>
							{editingId
								? updateMutation.isPending
									? 'Saving...'
									: 'Save'
								: createMutation.isPending
								? 'Creating...'
								: 'Create'}
						</button>
					</div>
				</div>
			</CustomModal>
			<ConfirmDeleteModal
				isOpen={Boolean(pendingDeleteId)}
				onCancel={() => setPendingDeleteId(null)}
				onConfirm={() => {
					if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId)
				}}
				title='Delete contact'
				message='Are you sure you want to delete this contact?'
			/>
		</div>
	)
}
