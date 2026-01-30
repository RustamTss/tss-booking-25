import { Menu, Transition } from '@headlessui/react'
import { ChevronDownIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import moment from 'moment-timezone'
import { Fragment, useMemo, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { getErrorMessage } from '../api/errors'
import { playBookingSound } from '../audio'
import BookingQuickModal from '../components/quickAddModals/BookingQuickModal'
import CustomSelect, { type Option } from '../components/shared/CustomSelect'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import { useToast } from '../components/shared/ui/ToastProvider'
import { useAuth } from '../context/AuthContext'
import useDebounce from '../hooks/useDebounce'
import { BUSINESS_TZ } from '../timezone'
import type {
	Bay,
	Company,
	ListResponse,
	Request,
	RequestStatus,
	Technician,
	Vehicle,
} from '../types'

const statusOpts: Option<string>[] = [
	{ label: 'All', value: '' },
	{ label: 'new', value: 'new' },
	{ label: 'in_review', value: 'in_review' },
	{ label: 'approved', value: 'approved' },
	{ label: 'rejected', value: 'rejected' },
]

export default function RequestsPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()
	const { role } = useAuth()
	const [status, setStatus] = useState<string>('')
	const [qRaw, setQRaw] = useState('')
	const q = useDebounce(qRaw, 300)
	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('requests_page') ?? 1))
	const limit = Math.max(1, Number(search.get('requests_limit') ?? 10))
	const formatForInput = (d: Date) =>
		moment.tz(d, BUSINESS_TZ).format('YYYY-MM-DDTHH:mm')

	const listQuery = useQuery<ListResponse<Request>>({
		queryKey: ['requests', { status, q }, page, limit],
		queryFn: async () => {
			const params: Record<string, string | number> = {
				envelope: 1,
				page,
				limit,
			}
			if (status) params.status = status
			if (q) params.q = q
			const res = await api.get<ListResponse<Request>>('/api/requests', {
				params,
			})
			return res.data
		},
	})

	// Directory data for booking modal
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const vehiclesQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})
	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})
	const techniciansQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('requests_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('requests_limit', String(l))
		next.set('requests_page', '1')
		setSearch(next, { replace: true })
	}

	const update = useMutation({
		mutationFn: async ({ id, next }: { id: string; next: RequestStatus }) =>
			api.put(`/api/requests/${id}`, { status: next }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['requests'] })
			success('Request status updated')
		},
		onError: err => error(getErrorMessage(err, 'Failed to update request')),
	})

	// Booking quick modal state
	const [modalOpen, setModalOpen] = useState(false)
	const [editingReqId, setEditingReqId] = useState<string | null>(null)
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

	const createBooking = useMutation({
		mutationFn: async () => {
			const payload = {
				complaint: form.complaint || undefined,
				description: form.description,
				fullbay_service_id: form.fullbay_service_id || undefined,
				vehicle_id: form.vehicle_id,
				bay_id: form.bay_id,
				technician_ids: form.technician_ids,
				company_id: form.company_id || undefined,
				start: moment
					.tz(form.start, 'YYYY-MM-DDTHH:mm', BUSINESS_TZ)
					.toDate()
					.toISOString(),
				end: form.end
					? moment
							.tz(form.end, 'YYYY-MM-DDTHH:mm', BUSINESS_TZ)
							.toDate()
							.toISOString()
					: undefined,
				status: 'open' as const,
				notes: '',
			}
			await api.post('/api/bookings', payload)
		},
		onSuccess: async () => {
			playBookingSound()
			success('Booking created')
			// Also approve the source request if present
			if (editingReqId) {
				try {
					await api.put(`/api/requests/${editingReqId}`, { status: 'approved' })
					success('Request approved')
					qc.invalidateQueries({ queryKey: ['requests'] })
				} catch (e) {
					error(
						getErrorMessage(e, 'Created booking, but failed to approve request')
					)
				}
			}
			setModalOpen(false)
			setEditingReqId(null)
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
		},
		onError: err =>
			error(
				getErrorMessage(err, 'Failed to create booking (bay may be occupied)')
			),
	})

	const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data])
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
	const deleteMutation = useMutation({
		mutationFn: async (id: string) => api.delete(`/api/requests/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['requests'] })
			success('Request deleted')
		},
		onError: err => error(getErrorMessage(err, 'Failed to delete request')),
	})

	const columns: Array<Column<Request & { actions?: null }>> = [
		{
			key: 'service_issue',
			header: 'Service Issue',
			render: r =>
				r.service_issue ? (
					<span className='line-clamp-2 max-w-xs'>{r.service_issue}</span>
				) : (
					<span className='text-slate-500'>Not set</span>
				),
		},
		{
			key: 'driver_name',
			header: 'Driver',
			render: r => (
				<NavLink to={`/requests/${r.id}`} className='text-sky-600 underline'>
					{r.driver_name || 'Not set'}
				</NavLink>
			),
		},
		{ key: 'phone', header: 'Phone' },
		{
			key: 'company_name',
			header: 'Company',
			render: r =>
				r.company_name ? (
					<span>{r.company_name}</span>
				) : (
					<span className='text-slate-500'>Not set</span>
				),
		},
		{
			key: 'unit_number',
			header: 'Unit',
			render: r => (
				<span>
					{r.unit_number || <span className='text-slate-500'>Not set</span>}
				</span>
			),
		},
		{
			key: 'start_at',
			header: 'Start',
			render: r => {
				const s = r.start_at as unknown as string
				if (!s) return <span className='text-slate-500'>Not set</span>
				const d = new Date(s)
				if (isNaN(d.getTime()))
					return <span className='text-slate-500'>Not set</span>
				return <span>{d.toLocaleString()}</span>
			},
		},
		{
			key: 'username',
			header: 'Username',
			render: r => <span>{r.username || '—'}</span>,
		},
		{
			key: 'status',
			header: 'Status',
			render: r => {
				const color: Record<RequestStatus, string> = {
					new: 'bg-sky-100 text-sky-800',
					in_review: 'bg-amber-100 text-amber-800',
					approved: 'bg-emerald-100 text-emerald-800',
					rejected: 'bg-rose-100 text-rose-800',
				}
				return (
					<span
						className={`rounded-full px-2 py-0.5 text-xs font-medium ${
							color[r.status] || 'bg-slate-100 text-slate-700'
						}`}
					>
						{r.status}
					</span>
				)
			},
		},
		{
			key: 'actions',
			header: 'Actions',
			render: r => {
				const actionsDisabled =
					update.isPending || r.status === 'approved' || r.status === 'rejected'
				return (
					<div className='flex flex-wrap gap-2'>
						<button
							type='button'
							onClick={() => update.mutate({ id: r.id, next: 'in_review' })}
							className='rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-60'
							disabled={actionsDisabled}
						>
							Review
						</button>
						<Menu as='div' className='relative inline-block text-left'>
							<Menu.Button
								disabled={actionsDisabled}
								className='inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60'
							>
								Approve
								<ChevronDownIcon className='h-4 w-4' />
							</Menu.Button>
							<Transition
								as={Fragment}
								enter='transition ease-out duration-100'
								enterFrom='transform opacity-0 scale-95'
								enterTo='transform opacity-100 scale-100'
								leave='transition ease-in duration-75'
								leaveFrom='transform opacity-100 scale-100'
								leaveTo='transform opacity-0 scale-95'
							>
								<Menu.Items className='absolute right-0 z-10 mt-1 w-56 origin-top-right rounded-md border border-slate-200 bg-white p-1 text-sm shadow-md focus:outline-none'>
									<Menu.Item>
										{({ active }) => (
											<button
												type='button'
												onClick={() => {
													setEditingReqId(r.id)
													// prefill modal from request when possible
													const preCompany =
														(companiesQuery.data ?? []).find(
															c =>
																c.name.toLowerCase() ===
																(r.company_name || '').toLowerCase()
														)?.id || ''
													setForm({
														complaint: r.service_issue
															? r.service_issue
															: r.driver_name
															? `Driver: ${r.driver_name}`
															: '',
														description: r.phone ? `Phone: ${r.phone}` : '',
														fullbay_service_id: '',
														vehicle_id: '',
														bay_id: '',
														technician_ids: [],
														start: r.start_at
															? formatForInput(new Date(r.start_at))
															: '',
														end: '',
														company_id: preCompany,
													})
													setModalOpen(true)
												}}
												className={`w-full rounded-md px-3 py-2 text-left ${
													active ? 'bg-slate-100' : ''
												}`}
											>
												Create booking…
											</button>
										)}
									</Menu.Item>
									<Menu.Item>
										{({ active }) => (
											<button
												type='button'
												onClick={() =>
													update.mutate({ id: r.id, next: 'approved' })
												}
												className={`w-full rounded-md px-3 py-2 text-left ${
													active ? 'bg-slate-100' : ''
												}`}
											>
												Booking already created
											</button>
										)}
									</Menu.Item>
								</Menu.Items>
							</Transition>
						</Menu>
						<button
							type='button'
							onClick={() => update.mutate({ id: r.id, next: 'rejected' })}
							className='rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-60'
							disabled={actionsDisabled}
						>
							Reject
						</button>
						{role === 'admin' && (
							<button
								type='button'
								onClick={() => setPendingDeleteId(r.id)}
								className='inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50'
								title='Delete'
							>
								<TrashIcon className='h-4 w-4' />
								Delete
							</button>
						)}
					</div>
				)
			},
		},
	]

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-xl font-semibold text-slate-900'>Requests</h1>
					<p className='text-sm text-slate-600'>Incoming service requests</p>
				</div>
				<div className='flex items-center gap-2'>
					<input
						type='text'
						value={qRaw}
						onChange={e => setQRaw(e.target.value)}
						placeholder='Search requests...'
						className='w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300'
					/>
					<div className='w-40'>
						<CustomSelect
							options={statusOpts}
							value={statusOpts.find(o => o.value === status) ?? statusOpts[0]}
							onChange={o => setStatus(o.value)}
						/>
					</div>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={rows}
				pagination
				pageParamKey='requests'
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
			<BookingQuickModal
				isOpen={modalOpen}
				isSaving={createBooking.isPending}
				isEdit={false}
				form={form}
				units={(vehiclesQuery.data ?? []).map(v => ({
					id: v.id,
					label: v.plate || v.vin || v.id,
					company_id: (v as unknown as { company_id?: string }).company_id,
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
					setEditingReqId(null)
				}}
				onSubmit={() => createBooking.mutate()}
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
				title='Delete request'
				message='Are you sure you want to delete this request?'
			/>
		</div>
	)
}
