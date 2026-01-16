import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CheckCircleIcon,
	DocumentDuplicateIcon,
	FunnelIcon,
	PencilSquareIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import moment from 'moment-timezone'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { getErrorMessage } from '../api/errors'
import { playBookingSound, playGoneSound, playReadySound } from '../audio'
import BookingQuickModal from '../components/quickAddModals/BookingQuickModal'
import CustomAutocomplete from '../components/shared/CustomAutocomplete'
import CustomSelect, { type Option } from '../components/shared/CustomSelect'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import ConfirmDeleteModal from '../components/shared/ui/ConfirmDeleteModal'
import CreateButton from '../components/shared/ui/CreateButton'
import CustomTooltip from '../components/shared/ui/CustomTooltip'
import { useToast } from '../components/shared/ui/ToastProvider'
import { useAuth } from '../context/AuthContext'
import useDebounce from '../hooks/useDebounce'
import { BUSINESS_TZ } from '../timezone'
import type {
	Bay,
	Booking,
	Company,
	ListResponse,
	Technician,
	Vehicle,
} from '../types'

function StatusBadge({ status }: { status: Booking['status'] }) {
	const colors: Record<Booking['status'], string> = {
		open: 'bg-amber-100 text-amber-800',
		in_progress: 'bg-blue-100 text-blue-800',
		closed: 'bg-emerald-100 text-emerald-800',
		canceled: 'bg-rose-100 text-rose-800',
		gone: 'bg-slate-100 text-slate-800',
	}
	return (
		<span
			className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}
		>
			{status === 'closed' ? 'ready' : status}
		</span>
	)
}

function BookingsPage() {
	const queryClient = useQueryClient()
	const { success, error } = useToast()
	const { role } = useAuth()
	const formatForInput = (d: Date) =>
		moment.tz(d, BUSINESS_TZ).format('YYYY-MM-DDTHH:mm')
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
		service_writer_id: '' as string | undefined,
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
	// Filters
	const [filterBay, setFilterBay] = useState<string>('')
	const [filterTech, setFilterTech] = useState<string>('')
	const [filterCompany, setFilterCompany] = useState<string>('')
	const [filterUnit, setFilterUnit] = useState<string>('')
	const [filterStatus, setFilterStatus] = useState<string>('')
	const [filterServiceWriter, setFilterServiceWriter] = useState<string>('')
	const [showFilters, setShowFilters] = useState(false)
	const [bookingIdRaw, setBookingIdRaw] = useState('')
	const qBooking = useDebounce(bookingIdRaw, 300)
	// Remote searchable options for filters
	const [companyQ, setCompanyQ] = useState('')
	const [unitQ, setUnitQ] = useState('')
	const [serviceWriterQ, setServiceWriterQ] = useState('')
	const debCompanyQ = useDebounce(companyQ, 300)
	const debUnitQ = useDebounce(unitQ, 300)
	const debServiceWriterQ = useDebounce(serviceWriterQ, 300)
	const [companyRemote, setCompanyRemote] = useState<
		Array<{ id: string; name: string }>
	>([])
	const [unitRemote, setUnitRemote] = useState<
		Array<{ id: string; label: string; company_id?: string }>
	>([])
	const [swRemote, setSwRemote] = useState<Array<{ id: string; name: string }>>(
		[]
	)
	// Fetch remote companies
	useEffect(() => {
		const run = async () => {
			const res = await api.get<Array<{ id: string; name: string }>>(
				'/api/companies',
				{
					params: { limit: 10, page: 1, q: debCompanyQ || undefined },
				}
			)
			setCompanyRemote(res.data ?? [])
		}
		void run()
	}, [debCompanyQ])
	// Fetch remote units (optionally filtered by company)
	useEffect(() => {
		const run = async () => {
			const res = await api.get<
				Array<{
					id: string
					plate: string
					vin: string
					nickname?: string
					company_id?: string
				}>
			>('/api/vehicles', {
				params: {
					limit: 10,
					page: 1,
					q: debUnitQ || undefined,
					company_id: filterCompany || undefined,
				},
			})
			setUnitRemote(
				(res.data ?? []).map(v => ({
					id: v.id,
					label: v.plate || v.nickname || v.vin || v.id,
					company_id: v.company_id,
				}))
			)
		}
		void run()
	}, [debUnitQ, filterCompany])
	// Fetch remote service writers
	useEffect(() => {
		const run = async () => {
			const res = await api.get<Array<{ id: string; name: string }>>(
				'/api/service-writers',
				{ params: { limit: 10, page: 1, q: debServiceWriterQ || undefined } }
			)
			setSwRemote(res.data ?? [])
		}
		void run()
	}, [debServiceWriterQ])
	const [search, setSearch] = useSearchParams()
	const page = Math.max(1, Number(search.get('bookings_page') ?? 1))
	const limit = Math.max(1, Number(search.get('bookings_limit') ?? 10))

	const { data, isLoading, isError } = useQuery<ListResponse<Booking>>({
		queryKey: [
			'bookings',
			{
				bay: filterBay,
				tech: filterTech,
				company: filterCompany,
				unit: filterUnit,
				status: filterStatus,
				service_writer: filterServiceWriter,
				q: qBooking,
			},
			page,
			limit,
		],
		queryFn: async () => {
			const params: Record<string, string | number> = {
				envelope: 1,
				page,
				limit,
			}
			if (filterBay) params.bay_id = filterBay
			if (filterTech) params.technician_id = filterTech
			if (filterCompany) params.company_id = filterCompany
			if (filterUnit) params.vehicle_id = filterUnit
			if (filterStatus) params.status = filterStatus
			if (filterServiceWriter) params.service_writer_id = filterServiceWriter
			if (qBooking) params.q = qBooking
			const res = await api.get<ListResponse<Booking>>('/api/bookings', {
				params,
			})
			return res.data
		},
	})

	const handleSetPage = (p: number) => {
		const next = new URLSearchParams(search)
		next.set('bookings_page', String(p))
		setSearch(next, { replace: true })
	}
	const handleSetLimit = (l: number) => {
		const next = new URLSearchParams(search)
		next.set('bookings_limit', String(l))
		next.set('bookings_page', '1')
		setSearch(next, { replace: true })
	}

	const mutation = useMutation({
		mutationFn: async ({
			id,
			action,
		}: {
			id: string
			action: 'close' | 'cancel' | 'gone'
		}) => {
			const path =
				action === 'close' ? 'close' : action === 'cancel' ? 'cancel' : 'gone'
			await api.put(`/api/bookings/${id}/${path}`)
		},
		onSuccess: (_data, vars) => {
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			if (vars.action === 'close') {
				success('Booking ready')
				playReadySound()
			} else if (vars.action === 'cancel') {
				success('Booking canceled')
			} else {
				success('Truck gone')
				playGoneSound()
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
				service_writer_id: form.service_writer_id || undefined,
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
				status: 'open',
				notes: '',
			}
			await api.post('/api/bookings', payload)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			setModalOpen(false)
			setEditingId(null)
			playBookingSound()
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
				service_writer_id: '',
			})
			success('Booking created')
		},
		onError: err => {
			const msg = getErrorMessage(
				err,
				'Failed to create booking (bay may be occupied for this time)'
			)
			error(msg)
		},
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
				service_writer_id: form.service_writer_id || undefined,
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
		onError: err => {
			const msg = getErrorMessage(
				err,
				'Failed to update booking (bay may be occupied for this time)'
			)
			error(msg)
		},
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
						className='font-mono text-sky-600 underline'
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
						{row.service_writer_name ? (
							<div className='text-xs'>
								<NavLink
									to={`/service-writers/${row.service_writer_id}`}
									className='text-sky-600 underline'
								>
									{`${row.service_writer_name}'s Booking`}
								</NavLink>
							</div>
						) : null}
						<div className='text-xs text-slate-500'>
							Unit:{' '}
							<NavLink
								to={`/vehicles/${row.vehicle_id}`}
								className='text-sky-600 underline'
							>
								{row.unit_label ||
									vehiclesQuery.data?.find(v => v.id === row.vehicle_id)
										?.plate ||
									vehiclesQuery.data?.find(v => v.id === row.vehicle_id)?.vin ||
									row.vehicle_id}
							</NavLink>
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
						{new Date(row.start).toLocaleString('en-US', {
							timeZone: BUSINESS_TZ,
						})}
						<div className='text-xs text-slate-500'>
							{row.end
								? `until ${new Date(row.end).toLocaleString('en-US', {
										timeZone: BUSINESS_TZ,
								  })}`
								: 'open'}
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
										technician_ids:
											(row.technician_ids as string[] | undefined) || [],
										start: formatForInput(new Date(row.start)),
										end: row.end ? formatForInput(new Date(row.end)) : '',
										company_id: row.company_id ?? '',
										service_writer_id: row.service_writer_id ?? '',
									})
									setModalOpen(true)
								}}
								className='inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50'
							>
								<PencilSquareIcon className='h-4 w-4' />
								Edit
							</button>
						</CustomTooltip>
						<CustomTooltip content='Mark ready'>
							<button
								type='button'
								onClick={() => mutation.mutate({ id: row.id, action: 'close' })}
								className='inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60'
								disabled={
									mutation.isPending ||
									row.status === 'closed' ||
									row.status === 'gone'
								}
							>
								<CheckCircleIcon className='h-4 w-4' />
								Ready
							</button>
						</CustomTooltip>
						<CustomTooltip content='Mark gone'>
							<button
								type='button'
								onClick={() => mutation.mutate({ id: row.id, action: 'gone' })}
								className='inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60'
								disabled={mutation.isPending || row.status !== 'closed'}
							>
								<CheckCircleIcon className='h-4 w-4' />
								Gone
							</button>
						</CustomTooltip>
						<CustomTooltip content='Cancel booking'>
							<button
								type='button'
								onClick={() =>
									mutation.mutate({ id: row.id, action: 'cancel' })
								}
								className='inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-60'
								disabled={
									mutation.isPending ||
									row.status === 'canceled' ||
									row.status === 'gone'
								}
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
						<button
							type='button'
							onClick={() => {
								void navigator.clipboard.writeText(row.fullbay_service_id || '')
								success('Fullbay Service ID copied')
							}}
							className='inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900'
							title='Copy Fullbay Service ID'
						>
							<span>{row.fullbay_service_id}</span>
							<DocumentDuplicateIcon className='h-4 w-4' />
						</button>
					) : (
						<span className='text-xs text-slate-400'>—</span>
					),
			},
		],
		[baysQuery.data, vehiclesQuery.data, mutation, role, success]
	)

	const bayOptions = useMemo<Option<string>[]>(
		() =>
			([{ label: 'All bays', value: '' }] as Option<string>[]).concat(
				(baysQuery.data ?? []).map(b => ({ label: b.name, value: b.id }))
			),
		[baysQuery.data]
	)
	const techOptions = useMemo<Option<string>[]>(
		() =>
			([{ label: 'All technicians', value: '' }] as Option<string>[]).concat(
				(techniciansQuery.data ?? []).map(t => ({ label: t.name, value: t.id }))
			),
		[techniciansQuery.data]
	)
	const unitOptions = useMemo<Option<string>[]>(
		() =>
			([{ label: 'All units', value: '' }] as Option<string>[]).concat(
				(vehiclesQuery.data ?? []).map(v => ({
					label: v.plate || v.vin || v.id,
					value: v.id,
				}))
			),
		[vehiclesQuery.data]
	)
	const statusOptions: Option<string>[] = [
		{ label: 'All statuses', value: '' },
		{ label: 'open', value: 'open' },
		// { label: 'in_progress', value: 'in_progress' },
		{ label: 'ready', value: 'closed' }, // closed shown as ready
		{ label: 'canceled', value: 'canceled' },
		{ label: 'gone', value: 'gone' },
	]

	async function handleExport() {
		const params: Record<string, string> = { export: 'csv' }
		if (filterBay) params.bay_id = filterBay
		if (filterTech) params.technician_id = filterTech
		if (filterCompany) params.company_id = filterCompany
		if (filterUnit) params.vehicle_id = filterUnit
		if (filterStatus) params.status = filterStatus
		const res = await api.get('/api/bookings', {
			params,
			responseType: 'blob',
		})
		const url = window.URL.createObjectURL(new Blob([res.data]))
		const a = document.createElement('a')
		a.href = url
		a.download = `bookings-${Date.now()}.csv`
		document.body.appendChild(a)
		a.click()
		a.remove()
		window.URL.revokeObjectURL(url)
	}

	if (isLoading)
		return <p className='text-sm text-slate-600'>Loading bookings...</p>
	if (isError || !data)
		return <p className='text-sm text-rose-600'>Failed to load bookings</p>

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<h1 className='text-xl font-semibold text-slate-900'>Bookings</h1>
				<div className='flex items-center gap-2'>
					<button
						type='button'
						onClick={() => setShowFilters(v => !v)}
						className='inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800'
						aria-label='Filters'
						title='Filters'
					>
						<FunnelIcon className='h-4 w-4' />
						Filters
					</button>
					<button
						type='button'
						onClick={handleExport}
						className='inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800'
						title='Download CSV'
					>
						<ArrowDownTrayIcon className='h-4 w-4' />
						Export
					</button>
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
								service_writer_id: '',
							})
							setModalOpen(true)
						}}
					>
						Create Booking
					</CreateButton>
				</div>
			</div>

			{/* Filters panel */}
			<div
				className={`transition-all duration-200 ${
					showFilters
						? 'max-h-[800px] opacity-100 overflow-visible'
						: 'max-h-0 opacity-0 overflow-hidden'
				}`}
			>
				<div className='mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
					<div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
						<label className='block text-sm'>
							<div className='mb-1 font-medium text-slate-700'>Booking ID</div>
							<input
								type='text'
								value={bookingIdRaw}
								onChange={e => setBookingIdRaw(e.target.value)}
								placeholder='Search number or ID...'
								className='w-full rounded-md border border-slate-300 px-3 py-2 text-sm'
							/>
						</label>
						<CustomAutocomplete<string>
							label='Company'
							value={
								filterCompany
									? {
											label:
												companyRemote.find(c => c.id === filterCompany)?.name ||
												companiesQuery.data?.find(c => c.id === filterCompany)
													?.name ||
												'',
											value: filterCompany,
									  }
									: undefined
							}
							onChange={opt => {
								setFilterCompany(opt.value)
								setUnitQ('') // reset unit query on company change
								setFilterUnit('')
							}}
							options={[
								{ label: '— All companies —', value: '' },
								...Array.from(
									new Map(
										[
											...(companyRemote ?? []),
											...(companiesQuery.data ?? []),
										].map(c => [c.id, { label: c.name, value: c.id }])
									).values()
								),
							]}
							onQueryChange={setCompanyQ}
							placeholder='Search companies...'
						/>
						<CustomAutocomplete<string>
							label='Unit'
							value={
								filterUnit
									? {
											label:
												unitRemote.find(u => u.id === filterUnit)?.label ||
												unitOptions.find(o => o.value === filterUnit)?.label ||
												'',
											value: filterUnit,
									  }
									: undefined
							}
							onChange={opt => setFilterUnit(opt.value)}
							options={[
								{ label: '— All units —', value: '' },
								...Array.from(
									new Map(
										[
											...(unitRemote ?? []).map(u => ({
												id: u.id,
												name: u.label,
											})),
											...(vehiclesQuery.data ?? []).map(v => ({
												id: v.id,
												name: v.plate || v.vin || v.id,
											})),
										].map(c => [c.id, { label: c.name, value: c.id }])
									).values()
								),
							]}
							onQueryChange={setUnitQ}
							placeholder='Search units...'
						/>
						<div>
							<CustomSelect
								placeholder='All bays'
								options={bayOptions}
								value={
									bayOptions.find(o => o.value === filterBay) ?? bayOptions[0]
								}
								onChange={opt => setFilterBay(opt.value)}
							/>
						</div>
						<div>
							<CustomSelect
								placeholder='All technicians'
								options={techOptions}
								value={
									techOptions.find(o => o.value === filterTech) ??
									techOptions[0]
								}
								onChange={opt => setFilterTech(opt.value)}
							/>
						</div>
						<div>
							<CustomSelect
								placeholder='All statuses'
								options={statusOptions}
								value={
									statusOptions.find(o => o.value === filterStatus) ??
									statusOptions[0]
								}
								onChange={opt => setFilterStatus(opt.value)}
							/>
						</div>
						<CustomAutocomplete<string>
							label='Service writer'
							value={
								filterServiceWriter
									? {
											label:
												swRemote.find(s => s.id === filterServiceWriter)
													?.name || '',
											value: filterServiceWriter,
									  }
									: undefined
							}
							onChange={opt => setFilterServiceWriter(opt.value)}
							options={[
								{ label: '— All service writers —', value: '' },
								...Array.from(
									new Map(
										[...(swRemote ?? [])].map(s => [
											s.id,
											{ label: s.name, value: s.id },
										])
									).values()
								),
							]}
							onQueryChange={setServiceWriterQ}
							placeholder='Search service writers...'
						/>
					</div>
					<div className='mt-4 flex items-center justify-end gap-2'>
						<button
							type='button'
							onClick={() => {
								setFilterBay('')
								setFilterTech('')
								setFilterCompany('')
								setFilterUnit('')
								setFilterStatus('')
								setFilterServiceWriter('')
								setBookingIdRaw('')
								setCompanyQ('')
								setUnitQ('')
								setServiceWriterQ('')
							}}
							className='inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
						>
							<ArrowPathIcon className='h-4 w-4' />
							Reset
						</button>
						<button
							type='button'
							onClick={() => setShowFilters(false)}
							className='inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800'
						>
							Apply filters
						</button>
					</div>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={data?.data ?? []}
				pagination
				pageParamKey='bookings'
				serverPagination={
					data?.pagination
						? {
								total: data.pagination.total,
								page: data.pagination.page,
								limit: data.pagination.limit,
								totalPages: data.pagination.totalPages,
								hasNextPage: data.pagination.hasNextPage,
								hasPrevPage: data.pagination.hasPrevPage,
								onPageChange: handleSetPage,
								onLimitChange: handleSetLimit,
						  }
						: undefined
				}
			/>

			<BookingQuickModal
				isOpen={modalOpen}
				isSaving={createMutation.isPending || updateMutation.isPending}
				isEdit={Boolean(editingId)}
				form={form}
				units={(vehiclesQuery.data ?? []).map(v => ({
					id: v.id,
					label:
						(v.plate || v.vin) + (v.company_name ? ` (${v.company_name})` : ''),
					company_id: (v as unknown as { company_id?: string }).company_id,
					company_name: (v as unknown as { company_name?: string })
						.company_name,
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
