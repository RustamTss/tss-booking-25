import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import UnitQuickModal from '../components/quickAddModals/UnitQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { Company, Vehicle } from '../types'

function VehiclesPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState<{
		company_id: string
		type: Vehicle['type']
		vin: string
		plate: string
		make: string
		model: string
		year: number
	}>({
		company_id: '',
		type: 'truck',
		vin: '',
		plate: '',
		make: '',
		model: '',
		year: new Date().getFullYear(),
	})

	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})

	const listQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})

	const createMutation = useMutation({
		mutationFn: async () =>
			api.post('/api/vehicles', { ...form, year: Number(form.year) }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['vehicles'] })
			setForm({
				company_id: '',
				type: 'truck',
				vin: '',
				plate: '',
				make: '',
				model: '',
				year: new Date().getFullYear(),
			})
			setModalOpen(false)
			success('Unit created')
		},
		onError: () => error('Failed to create unit'),
	})
	const updateMutation = useMutation({
		mutationFn: async (id: string) =>
			api.put(`/api/vehicles/${id}`, { ...form, year: Number(form.year) }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['vehicles'] })
			setEditingId(null)
			setModalOpen(false)
			success('Unit updated')
		},
		onError: () => error('Failed to update unit'),
	})
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/vehicles/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['vehicles'] })
			success('Unit deleted')
		},
		onError: () => error('Failed to delete unit'),
	})

	const openCreate = () => {
		setEditingId(null)
		setForm({
			company_id: '',
			type: 'truck',
			vin: '',
			plate: '',
			make: '',
			model: '',
			year: new Date().getFullYear(),
		})
		setModalOpen(true)
	}
	const openEdit = (v: Vehicle) => {
		setEditingId(v.id)
		setForm({
			company_id: v.company_id,
			type: v.type,
			vin: v.vin,
			plate: v.plate,
			make: v.make,
			model: v.model,
			year: v.year,
		})
		setModalOpen(true)
	}

	const columns: Array<Column<Vehicle & { actions?: null }>> = [
		{
			key: 'type',
			header: 'Type',
			render: row => <span className='uppercase'>{row.type}</span>,
		},
		{
			key: 'plate',
			header: 'Plate',
			render: row => (
				<NavLink to={`/vehicles/${row.id}`} className='text-sky-600 underline'>
					{row.plate || '—'}
				</NavLink>
			),
		},
		{
			key: 'vin',
			header: 'VIN',
			render: row => <span className='font-mono'>{row.vin || '—'}</span>,
		},
		{
			key: 'make',
			header: 'Make',
			render: row => <span>{row.make || '—'}</span>,
		},
		{
			key: 'model',
			header: 'Model',
			render: row => <span>{row.model || '—'}</span>,
		},
		{
			key: 'year',
			header: 'Year',
			render: row => <span>{row.year}</span>,
			className: 'text-right',
		},
		{
			key: 'actions',
			header: 'Actions',
			className: 'w-px',
			render: row => (
				<div className='flex items-center justify-end gap-2'>
					<CustomTooltip content='Edit unit'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
							onClick={() => openEdit(row)}
						>
							<PencilSquareIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
					<CustomTooltip content='Delete unit'>
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
				<h1 className='text-xl font-semibold text-slate-900'>Units</h1>
				<CreateButton onClick={openCreate}>Create Unit</CreateButton>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data ?? []}
				pageParamKey='vehicles'
			/>

			<UnitQuickModal
				isOpen={modalOpen}
				mode={editingId ? 'edit' : 'create'}
				isSaving={createMutation.isPending || updateMutation.isPending}
				form={form}
				companies={(companiesQuery.data ?? []).map(c => ({
					id: c.id,
					name: c.name,
				}))}
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
				title='Delete unit'
				message='Are you sure you want to delete this unit?'
			/>
		</div>
	)
}

export default VehiclesPage
