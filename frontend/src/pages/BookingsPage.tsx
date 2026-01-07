import {
	CheckCircleIcon,
	PencilSquareIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import BookingQuickModal from '../components/quickAddModals/BookingQuickModal'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import { useAuth } from '../context/AuthContext'
import type { Bay, Booking, Company, Technician, Vehicle } from '../types'

function StatusBadge({ status }: { status: Booking['status'] }) {
	const colors: Record<Booking['status'], string> = {
		open: 'bg-amber-100 text-amber-800',
		in_progress: 'bg-blue-100 text-blue-800',
		closed: 'bg-emerald-100 text-emerald-800',
		canceled: 'bg-rose-100 text-rose-800',
	}
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}
		>
			{status}
		</span>
	)
}

function BookingsPage() {
	const queryClient = useQueryClient()
	const { success, error } = useToast()
	const { role } = useAuth()
	const [modalOpen, setModalOpen] = useState(false)
	const [editingId, setEditingId] = useState<string | null>(null)
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const [form, setForm] = useState({
		complaint: '',
		description: '',
		fullbay_service_id: '',
		vehicle_id: '',
		bay_id: '',
		technician_ids: [] as string[],
		start: '',
		end: '',
		company_id: '',
	})
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const vehiclesQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})
	const techniciansQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})
	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})
	const { data, isLoading, isError } = useQuery({
		queryKey: ['bookings'],
		queryFn: async () => {
			const res = await api.get<Booking[]>('/api/bookings')
			return res.data
		},
	})

	const mutation = useMutation({
		mutationFn: async ({
			id,
			action,
		}: {
			id: string
			action: 'close' | 'cancel'
		}) => {
			const path = action === 'close' ? 'close' : 'cancel'
			await api.put(`/api/bookings/${id}/${path}`)
		},
		onSuccess: (_data, vars) => {
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			if (vars.action === 'close') {
				success('Booking closed')
			} else {
				success('Booking canceled')
			}
		},
		onError: () => error('Failed to update booking status'),
	})

	const createMutation = useMutation({
		mutationFn: async () => {
			const payload = {
				complaint: form.complaint || undefined,
				description: form.description,
				fullbay_service_id: form.fullbay_service_id || undefined,
				vehicle_id: form.vehicle_id,
				bay_id: form.bay_id,
				technician_ids: form.technician_ids,
				company_id: form.company_id || undefined,
				start: new Date(form.start).toISOString(),
				end: form.end ? new Date(form.end).toISOString() : undefined,
				status: 'open',
				notes: '',
			}
			await api.post('/api/bookings', payload)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			setModalOpen(false)
			setEditingId(null)
			setForm({
				complaint: '',
				description: '',
				fullbay_service_id: '',
				vehicle_id: '',
				bay_id: '',
				technician_ids: [],
				start: '',
				end: '',
				company_id: '',
			})
			success('Booking created')
		},
		onError: () => error('Failed to create booking'),
	})

	const updateMutation = useMutation({
		mutationFn: async (id: string) => {
			const payload = {
				complaint: form.complaint || undefined,
				description: form.description,
				fullbay_service_id: form.fullbay_service_id || undefined,
				vehicle_id: form.vehicle_id,
				bay_id: form.bay_id,
				technician_ids: form.technician_ids,
				company_id: form.company_id || undefined,
				start: new Date(form.start).toISOString(),
				end: form.end ? new Date(form.end).toISOString() : undefined,
				status: 'open',
				notes: '',
			}
			await api.put(`/api/bookings/${id}`, payload)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			setModalOpen(false)
			setEditingId(null)
			success('Booking updated')
		},
		onError: () => error('Failed to update booking'),
	})

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/bookings/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			success('Booking deleted')
		},
		onError: () => error('Failed to delete booking'),
	})

	const columns: Array<Column<Booking & { actions?: null }>> = useMemo(
		() => [
			{
				key: 'number',
				header: 'ID',
				render: row => (
					<NavLink
						to={`/bookings/${row.id}`}
						className='font-mono text-slate-900 underline'
					>
						{row.number || row.id.slice(0, 6)}
					</NavLink>
				),
				className: 'w-px',
			},
			{
				key: 'complaint',
				header: 'Complaint',
				render: row => (
					<div className='text-sm'>
						<div className='font-medium text-slate-900'>
							{row.complaint || '—'}
						</div>
						<div className='text-xs text-slate-600'>{row.description}</div>
						<div className='text-xs text-slate-500'>
							Unit:{' '}
							{vehiclesQuery.data?.find(v => v.id === row.vehicle_id)?.plate ||
								vehiclesQuery.data?.find(v => v.id === row.vehicle_id)?.vin ||
								row.vehicle_id}
						</div>
					</div>
				),
			},
			{
				key: 'bay',
				header: 'Bay',
				render: row => (
					<span className='text-sm text-slate-700'>
						{baysQuery.data?.find(b => b.id === row.bay_id)?.name || row.bay_id}
					</span>
				),
			},
			{
				key: 'start',
				header: 'Start',
				render: row => (
					<div className='text-sm text-slate-700'>
						{new Date(row.start).toLocaleString()}
						<div className='text-xs text-slate-500'>
							{row.end ? `until ${new Date(row.end).toLocaleString()}` : 'open'}
						</div>
					</div>
				),
			},
			{
				key: 'status',
				header: 'Status',
				render: row => <StatusBadge status={row.status} />,
			},
			{
				key: 'actions',
				header: 'Actions',
				render: row => (
					<div className='flex items-center gap-2'>
						<CustomTooltip content='Edit booking'>
							<button
								type='button'
								onClick={() => {
									setEditingId(row.id)
									setForm({
										complaint: row.complaint ?? '',
										description: row.description,
										fullbay_service_id: row.fullbay_service_id ?? '',
										vehicle_id: row.vehicle_id,
										bay_id: row.bay_id,
										technician_ids: row.technician_ids,
										start: row.start.slice(0, 16),
										end: row.end ? row.end.slice(0, 16) : '',
										company_id: row.company_id ?? '',
									})
									setModalOpen(true)
								}}
								className='inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50'
							>
								<PencilSquareIcon className='h-4 w-4' />
								Edit
							</button>
						</CustomTooltip>
						<CustomTooltip content='Close booking'>
							<button
								type='button'
								onClick={() => mutation.mutate({ id: row.id, action: 'close' })}
								className='inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60'
								disabled={mutation.isPending}
							>
								<CheckCircleIcon className='h-4 w-4' />
								Close
							</button>
						</CustomTooltip>
						<CustomTooltip content='Cancel booking'>
							<button
								type='button'
								onClick={() =>
									mutation.mutate({ id: row.id, action: 'cancel' })
								}
								className='inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-60'
								disabled={mutation.isPending}
							>
								<XMarkIcon className='h-4 w-4' />
								Cancel
							</button>
						</CustomTooltip>
						{role === 'admin' && (
							<CustomTooltip content='Delete booking'>
								<button
									type='button'
									onClick={() => setPendingDeleteId(row.id)}
									className='inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50'
								>
									<TrashIcon className='h-4 w-4' />
									Delete
								</button>
							</CustomTooltip>
						)}
					</div>
				),
			},
			{
				key: 'fullbay_service_id',
				header: 'Fullbay',
				render: row =>
					row.fullbay_service_id ? (
						<a
							href={
								(import.meta.env.VITE_FULLBAY_URL as string) ??
								'https://app.fullbay.com'
							}
							target='_blank'
							rel='noreferrer'
							className='text-xs text-slate-700 underline underline-offset-2'
							title='Open in Fullbay'
						>
							{row.fullbay_service_id}
						</a>
					) : (
						<span className='text-xs text-slate-400'>—</span>
					),
			},
		],
		[baysQuery.data, vehiclesQuery.data, mutation, role]
	)

	if (isLoading)
		return <p className='text-sm text-slate-600'>Loading bookings...</p>
	if (isError || !data)
		return <p className='text-sm text-rose-600'>Failed to load bookings</p>

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<h1 className='text-xl font-semibold text-slate-900'>Bookings</h1>
				<CreateButton
					onClick={() => {
						setEditingId(null)
						setForm({
							complaint: '',
							description: '',
							fullbay_service_id: '',
							vehicle_id: '',
							bay_id: '',
							technician_ids: [],
							start: '',
							end: '',
							company_id: '',
						})
						setModalOpen(true)
					}}
				>
					Create Booking
				</CreateButton>
			</div>

			<CustomTable
				columns={columns}
				data={data ?? []}
				pageParamKey='bookings'
			/>

			<BookingQuickModal
				isOpen={modalOpen}
				isSaving={createMutation.isPending || updateMutation.isPending}
				isEdit={Boolean(editingId)}
				form={form}
				units={(vehiclesQuery.data ?? []).map(v => ({
					id: v.id,
					label: v.plate || v.vin,
				}))}
				bays={(baysQuery.data ?? []).map(b => ({ id: b.id, label: b.name }))}
				companies={(companiesQuery.data ?? []).map(c => ({
					id: c.id,
					label: c.name,
				}))}
				technicians={(techniciansQuery.data ?? []).map(t => ({
					id: t.id,
					label: t.name,
				}))}
				onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
				onCancel={() => {
					setModalOpen(false)
					// clear editing state and leave form clean for next create
					setEditingId(null)
					setForm(prev => ({ ...prev }))
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
				title='Delete booking'
				message='Are you sure you want to delete this booking?'
			/>
		</div>
	)
}

export default BookingsPage
