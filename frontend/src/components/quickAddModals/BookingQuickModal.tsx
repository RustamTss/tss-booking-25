import { PlusIcon } from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import CustomAutocomplete from '../shared/CustomAutocomplete'
import CustomInput from '../shared/CustomInput'
import CustomModal from '../shared/CustomModal'
import MultiAutocomplete from '../shared/MultiAutocomplete'

type Option = {
	id: string
	label: string
	company_id?: string
	company_name?: string
}

type BookingForm = {
	description: string
	complaint?: string
	fullbay_service_id?: string
	vehicle_id: string
	bay_id: string
	company_id: string
	technician_ids: string[]
	start: string
	end: string
}

type Props = {
	isOpen: boolean
	isSaving: boolean
	form: BookingForm
	isEdit?: boolean
	units: Option[]
	bays: Option[]
	companies: Option[]
	technicians: Option[]
	onChange: (patch: Partial<BookingForm>) => void
	onCancel: () => void
	onSubmit: () => void
}

export default function BookingQuickModal({
	isOpen,
	isSaving,
	form,
	isEdit = false,
	units,
	bays,
	companies,
	technicians,
	onChange,
	onCancel,
	onSubmit,
}: Props) {
	// Remote search state for units and companies (limit 10)
	const [unitOptions, setUnitOptions] = useState<Option[]>([])
	const [companyOptions, setCompanyOptions] = useState<Option[]>([])
	const [unitQuery, setUnitQuery] = useState('')
	const [companyQuery, setCompanyQuery] = useState('')

	// debounce helper
	const useDebounce = (value: string, delay: number) => {
		const [debounced, setDebounced] = useState(value)
		useEffect(() => {
			const t = setTimeout(() => setDebounced(value), delay)
			return () => clearTimeout(t)
		}, [value, delay])
		return debounced
	}
	const debouncedUnitQ = useDebounce(unitQuery, 250)
	const debouncedCompanyQ = useDebounce(companyQuery, 250)

	useEffect(() => {
		const fetchUnits = async () => {
			const q = debouncedUnitQ.trim()
			// search from 1 char; if empty, still load first page
			if (q.length === 0 || q.length >= 1) {
				const res = await api.get<
					{
						id: string
						plate: string
						vin: string
						nickname?: string
						company_id?: string
						company_name?: string
					}[]
				>('/api/vehicles', {
					params: {
						limit: 10,
						page: 1,
						q: q.length >= 1 ? q : undefined,
						company_id: form.company_id || undefined,
					},
				})
				setUnitOptions(
					(res.data ?? []).map(v => ({
						id: v.id,
						label:
							(v.plate || v.nickname || v.vin || '—') +
							(v.company_name ? ` (${v.company_name})` : ''),
						company_id: v.company_id,
						company_name: v.company_name,
					}))
				)
			}
		}
		void fetchUnits()
	}, [debouncedUnitQ, form.company_id])

	useEffect(() => {
		const fetchCompanies = async () => {
			const q = debouncedCompanyQ.trim()
			if (q.length === 0 || q.length >= 1) {
				const res = await api.get<{ id: string; name: string }[]>(
					'/api/companies',
					{
						params: { limit: 10, page: 1, q: q.length >= 1 ? q : undefined },
					}
				)
				setCompanyOptions(
					(res.data ?? []).map(c => ({ id: c.id, label: c.name }))
				)
			}
		}
		void fetchCompanies()
	}, [debouncedCompanyQ])

	// initial load (first page)
	useEffect(() => {
		setUnitQuery('')
		setCompanyQuery('')
	}, [isOpen])

	return (
		<CustomModal
			isOpen={isOpen}
			onClose={onCancel}
			title={isEdit ? 'Update booking' : 'Create booking'}
			maxWidthClassName='max-w-4xl'
			footer={
				<div className='flex justify-end gap-2'>
					<button
						type='button'
						onClick={onCancel}
						className='rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
					>
						Cancel
					</button>
					<button
						type='button'
						onClick={onSubmit}
						disabled={isSaving}
						className='inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60'
					>
						{isEdit ? null : <PlusIcon className='h-4 w-4' />}
						{isSaving
							? isEdit
								? 'Saving...'
								: 'Creating...'
							: isEdit
							? 'Save'
							: 'Create'}
					</button>
				</div>
			}
		>
			<div className='grid gap-3'>
				<CustomInput
					label='Complaint'
					value={form.complaint || ''}
					onChange={v => onChange({ complaint: v })}
					placeholder='E.g., vibration at 60 mph'
					autoFocus
				/>
				<CustomInput
					label='Description'
					value={form.description}
					onChange={v => onChange({ description: v })}
					placeholder='Short notes'
				/>
				<CustomInput
					label='Service ID (Fullbay)'
					value={form.fullbay_service_id || ''}
					onChange={v => onChange({ fullbay_service_id: v })}
					placeholder='e.g., FB-12345'
				/>
				<div className='grid grid-cols-2 gap-3'>
					<CustomAutocomplete<string>
						label='Unit'
						required
						value={
							form.vehicle_id
								? {
										label:
											unitOptions.find(u => u.id === form.vehicle_id)?.label ||
											units.find(u => u.id === form.vehicle_id)?.label ||
											'',
										value: form.vehicle_id,
								  }
								: undefined
						}
						onChange={opt => {
							if (opt.value === '') {
								onChange({ vehicle_id: '' })
								return
							}
							// auto-set company from chosen unit when available
							const merged = new Map<string, Option>()
							unitOptions.forEach(u => merged.set(u.id, u))
							;(units as Option[]).forEach(u => merged.set(u.id, u))
							const chosen = merged.get(opt.value)
							if (chosen?.company_id) {
								onChange({
									vehicle_id: opt.value,
									company_id: chosen.company_id,
								})
							} else {
								onChange({ vehicle_id: opt.value })
							}
						}}
						options={useMemo(() => {
							// merge remote + provided; filter by selected company
							const merged = new Map<string, Option>()
							unitOptions.forEach(u => merged.set(u.id, u))
							;(units as Option[]).forEach(u => merged.set(u.id, u))
							let arr = Array.from(merged.values())
							if (form.company_id) {
								arr = arr.filter(o =>
									o.company_id ? o.company_id === form.company_id : true
								)
							}
							const opts = arr.map(v => ({ label: v.label, value: v.id }))
							return [{ label: '— Clear —', value: '' }, ...opts]
						}, [unitOptions, units, form.company_id])}
						onQueryChange={q => setUnitQuery(q)}
						placeholder='Select unit'
					/>
					<CustomAutocomplete<string>
						label='Bay'
						required
						value={
							form.bay_id
								? {
										label: bays.find(b => b.id === form.bay_id)?.label || '',
										value: form.bay_id,
								  }
								: undefined
						}
						onChange={opt => onChange({ bay_id: opt.value })}
						options={bays.map(b => ({ label: b.label, value: b.id }))}
						placeholder='Select bay'
					/>
				</div>
				<div className='grid grid-cols-2 gap-3'>
					<CustomAutocomplete<string>
						label='Company (optional)'
						value={
							form.company_id
								? {
										label:
											companyOptions.find(c => c.id === form.company_id)
												?.label ||
											companies.find(c => c.id === form.company_id)?.label ||
											// fallback: derive from any unit that carries this company_id
											unitOptions.find(u => u.company_id === form.company_id)
												?.company_name ||
											(units as Option[]).find(
												u => u.company_id === form.company_id
											)?.company_name ||
											'',
										value: form.company_id,
								  }
								: undefined
						}
						onChange={opt => {
							if (opt.value === '') {
								onChange({ company_id: '', vehicle_id: '' })
								setUnitQuery('')
								return
							}
							onChange({ company_id: opt.value, vehicle_id: '' })
							setUnitQuery('')
						}}
						options={Array.from(
							new Map(
								[
									{ id: '', label: '— Clear —' } as Option,
									...companyOptions,
									...companies,
								].map(c => [c.id, { label: c.label, value: c.id }])
							).values()
						)}
						onQueryChange={q => setCompanyQuery(q)}
						placeholder='Select company'
					/>
					<div className='grid grid-cols-2 gap-3'>
						<label className='block text-sm'>
							<div className='mb-1 font-medium text-slate-700'>Start</div>
							<input
								type='datetime-local'
								lang='en-US'
								value={form.start}
								onChange={e => onChange({ start: e.target.value })}
								className='w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
							/>
						</label>
						<label className='block text-sm'>
							<div className='mb-1 font-medium text-slate-700'>
								End (optional)
							</div>
							<input
								type='datetime-local'
								lang='en-US'
								value={form.end}
								onChange={e => onChange({ end: e.target.value })}
								className='w-full rounded-lg border border-slate-200 px-3 py-2 text-sm'
							/>
						</label>
					</div>
				</div>
				<div className='grid grid-cols-2 gap-3'>
					<MultiAutocomplete<string>
						label='Technicians'
						value={form.technician_ids.map(id => ({
							label: technicians.find(t => t.id === id)?.label || '',
							value: id,
						}))}
						onChange={opts =>
							onChange({ technician_ids: opts.map(o => o.value) })
						}
						options={technicians.map(t => ({ label: t.label, value: t.id }))}
						placeholder='Select technicians'
					/>
				</div>
			</div>
		</CustomModal>
	)
}
