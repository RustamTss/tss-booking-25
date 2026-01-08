import {
	ArrowPathIcon,
	ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
	format,
	getDay,
	isSameDay,
	parse,
	startOfDay,
	startOfWeek,
} from 'date-fns'
import { enUS } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import {
	Calendar as BigCalendar,
	Views,
	dateFnsLocalizer,
	type Components as RBCComponents,
	type Event as RBCEvent,
	type EventProps as RBCEventProps,
	type SlotInfo,
	type View,
} from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { api } from '../api/client'
import CalendarMenuDropdown from '../components/calendar/CalendarMenuDropdown'
import FullWidthModal from '../components/calendar/FullWidthModal'
import BookingQuickModal from '../components/quickAddModals/BookingQuickModal'
import CustomSelect, { type Option } from '../components/shared/CustomSelect'
import CreateButton from '../components/shared/ui/CreateButton'
import type {
	Bay,
	Booking,
	BookingStatus,
	Company,
	Technician,
	Vehicle,
} from '../types'

type ViewMode = 'day' | 'week' | 'month' | 'agenda'

const locales = {
	'en-US': enUS,
}

const localizer = dateFnsLocalizer({
	format,
	parse,
	startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
	getDay,
	locales,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(BigCalendar as any)

function computeRange(currentDate: Date, view: ViewMode) {
	// Normalize ranges to midnight boundaries to avoid missing AM events
	if (view === 'day') {
		const s = startOfDay(currentDate)
		const e = new Date(s)
		e.setDate(e.getDate() + 1)
		return { from: s.toISOString(), to: e.toISOString() }
	}
	if (view === 'week') {
		const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
		const s = startOfDay(ws)
		const e = new Date(s)
		e.setDate(e.getDate() + 7)
		return { from: s.toISOString(), to: e.toISOString() }
	}
	if (view === 'month') {
		const s = startOfDay(
			new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
		)
		const e = new Date(s)
		e.setMonth(e.getMonth() + 1)
		return { from: s.toISOString(), to: e.toISOString() }
	}
	// agenda (open range: one week back, 30 days forward)
	const s = startOfDay(new Date(currentDate))
	s.setDate(s.getDate() - 7)
	const e = startOfDay(new Date(currentDate))
	e.setDate(e.getDate() + 30)
	return { from: s.toISOString(), to: e.toISOString() }
}

function CalendarPage() {
	const [view, setView] = useState<ViewMode>('month')
	const [date, setDate] = useState<Date>(new Date())
	const [editingId, setEditingId] = useState<string | null>(null)
	const [form, setForm] = useState({
		complaint: '',
		description: '',
		fullbay_service_id: '',
		vehicle_id: '',
		bay_id: '',
		technician_ids: [] as string[],
		company_id: '',
		start: '',
		end: '',
		status: 'open' as BookingStatus,
		notes: '',
	})
	const [modalOpen, setModalOpen] = useState(false)
	const [fullscreen, setFullscreen] = useState(false)
	// Month view "+X more" dropdown state
	const [moreState, setMoreState] = useState<{
		open: boolean
		events: RBCEvent[]
		rect: DOMRect | null
		date: Date | null
	}>({ open: false, events: [], rect: null, date: null })
	// Filters
	const [filterBay, setFilterBay] = useState<string>('')
	const [filterTech, setFilterTech] = useState<string>('')
	const [filterCompany, setFilterCompany] = useState<string>('')
	const queryClient = useQueryClient()
	const range = useMemo(() => computeRange(date, view), [date, view])

	// removed local text filters (now using dropdown filters)
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const techsQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})
	const vehiclesQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})
	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})
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
				(techsQuery.data ?? []).map(t => ({ label: t.name, value: t.id }))
			),
		[techsQuery.data]
	)
	const companyOptions = useMemo<Option<string>[]>(
		() =>
			([{ label: 'All companies', value: '' }] as Option<string>[]).concat(
				(companiesQuery.data ?? []).map(c => ({ label: c.name, value: c.id }))
			),
		[companiesQuery.data]
	)

	const { data, isLoading, isError } = useQuery({
		queryKey: ['agenda', range],
		queryFn: async () => {
			const res = await api.get<Booking[]>('/api/bookings/agenda', {
				params: range,
			})
			return res.data
		},
	})

	// Align Day view's visible date with the first returned event so header and data match
	useEffect(() => {
		if (view !== 'day') return
		if (!Array.isArray(data) || data.length === 0) return
		const firstDate = startOfDay(new Date(data[0].start))
		if (!isSameDay(firstDate, date)) {
			setDate(firstDate)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [view, data])

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
				status: 'open' as BookingStatus,
				notes: '',
			}
			await api.post('/api/bookings', payload)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['agenda'] })
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
				company_id: '',
				start: '',
				end: '',
				status: 'open',
				notes: '',
			})
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
				start: new Date(form.start).toISOString(),
				end: form.end ? new Date(form.end).toISOString() : undefined,
				// do not set status to avoid unintended resets
				notes: '',
			}
			await api.put(`/api/bookings/${id}`, payload)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['agenda'] })
			queryClient.invalidateQueries({ queryKey: ['bookings'] })
			setModalOpen(false)
			setEditingId(null)
		},
	})

	// Custom header for the time gutter (top-left empty cell in day/week views)
	const TimeGutterHeader = () => (
		<div className='pt-4'>
			<span className='inline-flex items-center rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white'>
				Unclosed
			</span>
		</div>
	)

	const mainCalendarComponents = {
		popup: () => null,
		timeGutterHeader: TimeGutterHeader,
	} as unknown as RBCComponents<RBCEvent, object>
	const fullscreenCalendarComponents: RBCComponents<RBCEvent, object> = {
		timeGutterHeader: TimeGutterHeader,
	}

	const events = useMemo<RBCEvent[]>(() => {
		if (!data) return []
		const vehicles = vehiclesQuery.data ?? []
		const bays = baysQuery.data ?? []
		const techs = techsQuery.data ?? []

		return data
			.filter(item => (filterBay ? item.bay_id === filterBay : true))
			.filter(item =>
				filterCompany ? item.company_id === filterCompany : true
			)
			.filter(item =>
				filterTech ? item.technician_ids?.includes(filterTech) : true
			)
			.map(item => {
				const v = vehicles.find(v => v.id === item.vehicle_id)
				const plate = v?.plate || v?.vin || ''
				const bay = bays.find(b => b.id === item.bay_id)?.name || ''
				const techNames = (item.technician_ids || [])
					.map(id => techs.find(t => t.id === id)?.name)
					.filter(Boolean)
					.join(', ')
				return {
					id: item.id,
					title: [techNames, plate, bay].filter(Boolean).join(' · '),
					start: new Date(item.start),
					end: item.end
						? new Date(item.end)
						: new Date(new Date(item.start).getTime() + 60 * 60 * 1000),
					resource: item,
				} as RBCEvent
			})
	}, [
		data,
		vehiclesQuery.data,
		baysQuery.data,
		techsQuery.data,
		filterBay,
		filterTech,
		filterCompany,
	])

	// Event appearance (Google Calendar-like)
	const eventPropGetter: NonNullable<
		React.ComponentProps<typeof BigCalendar>['eventPropGetter']
	> = () => {
		const color = '#039be5'
		return {
			className: 'gcal-event',
			style: {
				backgroundColor: color,
				border: `1px solid #fff`,
				borderLeft: `2px solid #fff`,
				color: '#fff',
				borderRadius: 6,
				padding: '2px 6px',
			},
		}
	}

	// Keep compact content; we don't expand details here
	const EventContent = ({ title }: RBCEventProps<RBCEvent>) => {
		return <span className='gcal-event-content'>{title as string}</span>
	}

	const formatForInput = (d: Date) => {
		const pad = (n: number) => String(n).padStart(2, '0')
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
			d.getDate()
		)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
	}

	const handleSlot = (slot: SlotInfo) => {
		// Enter create mode and fully reset the form for a clean create experience
		setEditingId(null)
		const startDate =
			slot.start instanceof Date ? slot.start : new Date(slot.start)
		const endDate =
			slot.end != null
				? slot.end instanceof Date
					? slot.end
					: new Date(slot.end)
				: null
		setForm({
			complaint: '',
			description: '',
			fullbay_service_id: '',
			vehicle_id: '',
			bay_id: '',
			technician_ids: [],
			company_id: '',
			start: formatForInput(startDate),
			end: endDate ? formatForInput(endDate) : '',
			status: 'open',
			notes: '',
		})
		setModalOpen(true)
	}

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h1 className='text-xl font-semibold text-slate-900'>
						Booking calendar
					</h1>
					<p className='text-sm text-slate-600'>
						Day / week / month / agenda with open slots
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<button
						type='button'
						onClick={() => setFullscreen(true)}
						className='rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800'
					>
						<ArrowsPointingOutIcon className='mr-1 inline h-4 w-4' />
						Full screen
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
								company_id: '',
								start: '',
								end: '',
								status: 'open',
								notes: '',
							})
							setModalOpen(true)
						}}
					>
						Create Booking
					</CreateButton>
				</div>
			</div>

			<section className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
				<div className='flex items-center justify-between'>
					<div>
						<h2 className='text-sm font-semibold text-slate-900'>
							Events ({view})
						</h2>
						<p className='text-xs text-slate-500'>
							Double click on event fills the form. Click a slot to create.
						</p>
					</div>
					<div className='flex items-center gap-2'>
						<div className='w-40'>
							<CustomSelect
								placeholder='All bays'
								options={bayOptions}
								value={
									bayOptions.find(o => o.value === filterBay) ?? bayOptions[0]
								}
								onChange={opt => setFilterBay(opt.value)}
							/>
						</div>
						<div className='w-52'>
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
						<div className='w-44'>
							<CustomSelect
								placeholder='All companies'
								options={companyOptions}
								value={
									companyOptions.find(o => o.value === filterCompany) ??
									companyOptions[0]
								}
								onChange={opt => setFilterCompany(opt.value)}
							/>
						</div>
						<button
							type='button'
							onClick={() => {
								setFilterBay('')
								setFilterTech('')
								setFilterCompany('')
							}}
							className='inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50'
						>
							<ArrowPathIcon className='h-4 w-4' />
							Reset
						</button>
					</div>
				</div>

				{isLoading ? (
					<p className='text-sm text-slate-600'>Loading...</p>
				) : null}
				{isError ? (
					<p className='text-sm text-rose-600'>Failed to load</p>
				) : null}
				<div
					className='mt-3 p-4'
					style={{ height: 'calc(100vh - 220px)', boxSizing: 'border-box' }}
				>
					<DnDCalendar
						localizer={localizer}
						events={events}
						date={date}
						view={view}
						eventPropGetter={eventPropGetter}
						components={{ ...mainCalendarComponents, event: EventContent }}
						popup
						onView={(v: View) => setView(v as ViewMode)}
						onNavigate={(d: Date) => setDate(d)}
						defaultView={Views.MONTH}
						views={[Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA]}
						scrollToTime={new Date(1970, 0, 1, 6, 0, 0)}
						min={new Date(1970, 0, 1, 6, 0, 0)}
						max={new Date(1970, 0, 1, 21, 0, 0)}
						style={{ height: '100%' }}
						onSelectEvent={(event: RBCEvent) => {
							const booking = event.resource as Booking
							setEditingId(booking.id)
							setForm(prev => ({
								...prev,
								complaint: booking.complaint || '',
								description: booking.description,
								vehicle_id: booking.vehicle_id,
								company_id: booking.company_id,
								fullbay_service_id: booking.fullbay_service_id || '',
								technician_ids: booking.technician_ids,
								bay_id: booking.bay_id,
								start: formatForInput(new Date(booking.start)),
								end: booking.end ? formatForInput(new Date(booking.end)) : '',
								status: booking.status,
								notes: booking.notes,
							}))
							setModalOpen(true)
						}}
						selectable
						onSelectSlot={handleSlot}
						onEventDrop={async ({ event, start, end }) => {
							const booking = event.resource as Booking
							const startIso = (
								start instanceof Date ? start : new Date(start)
							).toISOString()
							const endIso = end
								? (end instanceof Date ? end : new Date(end)).toISOString()
								: undefined
							await api.put(`/api/bookings/${booking.id}`, {
								...booking,
								start: startIso,
								end: endIso,
							})
							queryClient.invalidateQueries({ queryKey: ['agenda'] })
							queryClient.invalidateQueries({ queryKey: ['bookings'] })
						}}
						onEventResize={async ({ event, start, end }) => {
							const booking = event.resource as Booking
							const startIso = (
								start instanceof Date ? start : new Date(start)
							).toISOString()
							const endIso = end
								? (end instanceof Date ? end : new Date(end)).toISOString()
								: undefined
							await api.put(`/api/bookings/${booking.id}`, {
								...booking,
								start: startIso,
								end: endIso,
							})
							queryClient.invalidateQueries({ queryKey: ['agenda'] })
							queryClient.invalidateQueries({ queryKey: ['bookings'] })
						}}
						// Open custom dropdown instead of drilling down when "+X more" is clicked
						onShowMore={
							((evts: RBCEvent[], _date: Date, cell?: HTMLElement) => {
								const rect = cell?.getBoundingClientRect() ?? null
								setMoreState({ open: true, events: evts, rect, date: _date })
							}) as unknown as (events: RBCEvent[], date: Date) => void
						}
						// Hide the built-in overlay popup via a null component
					/>
					<CalendarMenuDropdown
						open={moreState.open}
						rect={moreState.rect}
						events={moreState.events}
						onClose={() =>
							setMoreState(s => ({ ...s, open: false, events: [] }))
						}
						onSelect={b => {
							setMoreState(s => ({ ...s, open: false }))
							setEditingId(b.id)
							setForm(prev => ({
								...prev,
								complaint: b.complaint || '',
								description: b.description,
								vehicle_id: b.vehicle_id,
								company_id: b.company_id,
								fullbay_service_id: b.fullbay_service_id || '',
								technician_ids: b.technician_ids,
								bay_id: b.bay_id,
								start: formatForInput(new Date(b.start)),
								end: b.end ? formatForInput(new Date(b.end)) : '',
								status: b.status,
								notes: b.notes,
							}))
							setModalOpen(true)
						}}
					/>
				</div>
			</section>

			<BookingQuickModal
				isOpen={modalOpen}
				isSaving={createMutation.isPending || updateMutation.isPending}
				isEdit={Boolean(editingId)}
				form={form}
				units={(vehiclesQuery.data ?? []).map(v => ({
					id: v.id,
					label:
						(v.plate || v.vin || `${v.make} ${v.model}`) +
						(v.company_name ? ` (${v.company_name})` : ''),
					company_id: (v as any).company_id,
					company_name: (v as any).company_name,
				}))}
				bays={(baysQuery.data ?? []).map(b => ({ id: b.id, label: b.name }))}
				companies={(companiesQuery.data ?? []).map(c => ({
					id: c.id,
					label: c.name,
				}))}
				technicians={(techsQuery.data ?? []).map(t => ({
					id: t.id,
					label: t.name,
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

			<FullWidthModal
				isOpen={fullscreen}
				onClose={() => setFullscreen(false)}
				title={`Events (${view})`}
			>
				<div className='h-full p-4' style={{ boxSizing: 'border-box' }}>
					<div className='mb-3 flex items-center gap-2'>
						<div className='w-40'>
							<CustomSelect
								placeholder='All bays'
								options={bayOptions}
								value={
									bayOptions.find(o => o.value === filterBay) ?? bayOptions[0]
								}
								onChange={opt => setFilterBay(opt.value)}
							/>
						</div>
						<div className='w-52'>
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
						<div className='w-44'>
							<CustomSelect
								placeholder='All companies'
								options={companyOptions}
								value={
									companyOptions.find(o => o.value === filterCompany) ??
									companyOptions[0]
								}
								onChange={opt => setFilterCompany(opt.value)}
							/>
						</div>
						<button
							type='button'
							onClick={() => {
								setFilterBay('')
								setFilterTech('')
								setFilterCompany('')
							}}
							className='inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50'
						>
							<ArrowPathIcon className='h-4 w-4' />
							Reset
						</button>
					</div>
					<DnDCalendar
						localizer={localizer}
						events={events}
						date={date}
						view={view}
						eventPropGetter={eventPropGetter}
						components={{
							...fullscreenCalendarComponents,
							event: EventContent,
						}}
						onView={(v: View) => setView(v as ViewMode)}
						onNavigate={(d: Date) => setDate(d)}
						defaultView={Views.MONTH}
						views={[Views.DAY, Views.WEEK, Views.MONTH, Views.AGENDA]}
						// Working hours: 6 AM - 9 PM in day/week views
						scrollToTime={new Date(1970, 0, 1, 6, 0, 0)}
						min={new Date(1970, 0, 1, 6, 0, 0)}
						max={new Date(1970, 0, 1, 21, 0, 0)}
						style={{ height: '100%' }}
						onSelectEvent={(event: RBCEvent) => {
							const booking = event.resource as Booking
							setForm(prev => ({
								...prev,
								complaint: booking.complaint || '',
								description: booking.description,
								vehicle_id: booking.vehicle_id,
								company_id: booking.company_id,
								fullbay_service_id: booking.fullbay_service_id || '',
								technician_ids: booking.technician_ids,
								bay_id: booking.bay_id,
								start: formatForInput(new Date(booking.start)),
								end: booking.end ? formatForInput(new Date(booking.end)) : '',
								status: booking.status,
								notes: booking.notes,
							}))
							setModalOpen(true)
						}}
						selectable
						onSelectSlot={handleSlot}
						onEventDrop={async ({ event, start, end }) => {
							const booking = event.resource as Booking
							const startIso = (
								start instanceof Date ? start : new Date(start)
							).toISOString()
							const endIso = end
								? (end instanceof Date ? end : new Date(end)).toISOString()
								: undefined
							await api.put(`/api/bookings/${booking.id}`, {
								...booking,
								start: startIso,
								end: endIso,
							})
							queryClient.invalidateQueries({ queryKey: ['agenda'] })
							queryClient.invalidateQueries({ queryKey: ['bookings'] })
						}}
						onEventResize={async ({ event, start, end }) => {
							const booking = event.resource as Booking
							const startIso = (
								start instanceof Date ? start : new Date(start)
							).toISOString()
							const endIso = end
								? (end instanceof Date ? end : new Date(end)).toISOString()
								: undefined
							await api.put(`/api/bookings/${booking.id}`, {
								...booking,
								start: startIso,
								end: endIso,
							})
							queryClient.invalidateQueries({ queryKey: ['agenda'] })
							queryClient.invalidateQueries({ queryKey: ['bookings'] })
						}}
					/>
				</div>
			</FullWidthModal>
		</div>
	)
}

export default CalendarPage
