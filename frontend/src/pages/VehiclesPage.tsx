import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import UnitQuickModal from '../components/quickAddModals/UnitQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { Company, Vehicle, ListResponse } from '../types'
import useDebounce from '../hooks/useDebounce'

function VehiclesPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState<{
		company_id: string
		company_name?: string
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

	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('vehicles_page') ?? 1))
	const limit = Math.max(1, Number(search.get('vehicles_limit') ?? 10))
	const qRaw = search.get('vehicles_q') ?? ''
	const q = useDebounce(qRaw, 300)

	const listQuery = useQuery<ListResponse<Vehicle>>({
		queryKey: ['vehicles', page, limit, q],
		queryFn: async () =>
			(
				await api.get<ListResponse<Vehicle>>('/api/vehicles', {
					params: { envelope: 1, page, limit, q },
				})
			).data,
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('vehicles_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('vehicles_limit', String(l))
		next.set('vehicles_page', '1')
		setSearch(next, { replace: true })
	}
	const handleSetQ = (value: string) => {
		const next = new URLSearchParams(search)
		next.set('vehicles_q', value)
		next.set('vehicles_page', '1')
		setSearch(next, { replace: true })
	}

	const createMutation = useMutation({
		mutationFn: async () => {
			const payload = {
				company_id: form.company_id,
				type: form.type,
				vin: form.vin,
				plate: form.plate,
				make: form.make,
				model: form.model,
				year: Number(form.year),
			}
			return api.post('/api/vehicles', payload)
		},
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
		mutationFn: async (id: string) => {
			const payload = {
				company_id: form.company_id,
				type: form.type,
				vin: form.vin,
				plate: form.plate,
				make: form.make,
				model: form.model,
				year: Number(form.year),
			}
			return api.put(`/api/vehicles/${id}`, payload)
		},
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
			company_name: '',
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
			company_name: v.company_name || '',
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
			key: 'company',
			header: 'Company',
			render: row =>
				row.company_id ? (
					<NavLink
						to={`/companies/${row.company_id}`}
						className='text-sky-600 underline'
					>
						{row.company_name || row.company_id}
					</NavLink>
				) : (
					<span>—</span>
				),
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
				<div className='flex items-center gap-2'>
					<input
						type='text'
						value={qRaw}
						onChange={e => handleSetQ(e.target.value)}
						placeholder='Search units (plate or VIN)...'
						className='w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'
					/>
					<CreateButton onClick={openCreate}>Create Unit</CreateButton>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={listQuery.data?.data ?? []}
				pagination
				pageParamKey='vehicles'
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
