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
import type { Vehicle } from '../types'

type VehicleForm = {
	plate: string
	vin: string
	type: 'truck' | 'trailer'
	make: string
	model: string
	year: string
}

export default function CompanyUnitsTab({ companyId }: { companyId: string }) {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const listQuery = useQuery({
		queryKey: ['company-vehicles', companyId],
		queryFn: async () =>
			(
				await api.get<Vehicle[]>('/api/vehicles', {
					params: { company_id: companyId },
				})
			).data,
	})

	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState<VehicleForm>({
		plate: '',
		vin: '',
		type: 'truck',
		make: '',
		model: '',
		year: '',
	})

	const createMutation = useMutation({
		mutationFn: async () =>
			api.post('/api/vehicles', {
				company_id: companyId,
				type: form.type,
				vin: form.vin,
				plate: form.plate,
				make: form.make,
				model: form.model,
				year: form.year ? Number(form.year) : undefined,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['company-vehicles', companyId] })
			setModalOpen(false)
			setForm({
				plate: '',
				vin: '',
				type: 'truck',
				make: '',
				model: '',
				year: '',
			})
			success('Unit created')
		},
		onError: () => error('Failed to create unit'),
	})
	const updateMutation = useMutation({
		mutationFn: async (id: string) =>
			api.put(`/api/vehicles/${id}`, {
				company_id: companyId,
				type: form.type,
				vin: form.vin,
				plate: form.plate,
				make: form.make,
				model: form.model,
				year: form.year ? Number(form.year) : undefined,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['company-vehicles', companyId] })
			setEditingId(null)
			setModalOpen(false)
			success('Unit updated')
		},
		onError: () => error('Failed to update unit'),
	})
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/vehicles/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['company-vehicles', companyId] })
			setPendingDeleteId(null)
			success('Unit deleted')
		},
		onError: () => error('Failed to delete unit'),
	})

	type Row = Vehicle & { actions?: null }
	const columns: Array<Column<Row>> = [
		{
			key: 'plate',
			header: 'Plate',
			render: r => (
				<NavLink to={`/vehicles/${r.id}`} className='text-sky-600 underline'>
					{r.plate || '—'}
				</NavLink>
			),
		},
		{ key: 'vin', header: 'VIN' },
		{ key: 'type', header: 'Type' },
		{ key: 'make', header: 'Make' },
		{ key: 'model', header: 'Model' },
		{ key: 'year', header: 'Year', className: 'w-px' },
		{
			key: 'actions',
			header: 'Actions',
			className: 'w-px',
			render: r => (
				<div className='flex items-center justify-end gap-2'>
					<CustomTooltip content='Edit unit'>
						<button
							type='button'
							className='rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50'
							onClick={() => {
								setEditingId(r.id)
								setForm({
									plate: r.plate,
									vin: r.vin,
									type: r.type,
									make: r.make,
									model: r.model,
									year: String(r.year || ''),
								})
								setModalOpen(true)
							}}
						>
							<PencilSquareIcon className='h-4 w-4' />
						</button>
					</CustomTooltip>
					<CustomTooltip content='Delete unit'>
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
				<h3 className='text-sm font-semibold text-slate-900'>Units</h3>
				<CreateButton
					onClick={() => {
						setEditingId(null)
						setForm({
							plate: '',
							vin: '',
							type: 'truck',
							make: '',
							model: '',
							year: '',
						})
						setModalOpen(true)
					}}
				>
					Create Unit
				</CreateButton>
			</div>
			<CustomTable
				columns={columns}
				data={listQuery.data ?? []}
				pageParamKey='company_units'
			/>
			<UnitQuickModal
				isOpen={modalOpen}
				mode={editingId ? 'edit' : 'create'}
				isSaving={createMutation.isPending || updateMutation.isPending}
				form={{
					company_id: companyId,
					type: form.type,
					vin: form.vin,
					plate: form.plate,
					make: form.make,
					model: form.model,
					year: form.year ? Number(form.year) : new Date().getFullYear(),
				}}
				companies={[]}
				showCompany={false}
				onChange={patch =>
					setForm(f => ({
						...f,
						...(patch.type !== undefined ? { type: patch.type } : {}),
						...(patch.vin !== undefined ? { vin: patch.vin } : {}),
						...(patch.plate !== undefined ? { plate: patch.plate } : {}),
						...(patch.make !== undefined ? { make: patch.make } : {}),
						...(patch.model !== undefined ? { model: patch.model } : {}),
						...(patch.year !== undefined ? { year: String(patch.year) } : {}),
					}))
				}
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
					if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId)
				}}
				title='Delete unit'
				message='Are you sure you want to delete this unit?'
			/>
		</div>
	)
}
