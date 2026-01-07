import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { Bay, Company, Technician, Vehicle } from '../types'

function SectionCard({
	title,
	children,
}: {
	title: string
	children: React.ReactNode
}) {
	return (
		<div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
			<h2 className='text-sm font-semibold text-slate-900'>{title}</h2>
			<div className='mt-3 space-y-3'>{children}</div>
		</div>
	)
}

function DirectoryPage() {
	const qc = useQueryClient()

	// Services section removed

	const [techForm, setTechForm] = useState({
		name: '',
		skills: '',
		phone: '',
		email: '',
	})
	const techniciansQuery = useQuery({
		queryKey: ['technicians'],
		queryFn: async () => (await api.get<Technician[]>('/api/technicians')).data,
	})
	const createTech = useMutation({
		mutationFn: async () =>
			api.post('/api/technicians', {
				...techForm,
				skills: techForm.skills
					.split(',')
					.map(v => v.trim())
					.filter(Boolean),
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['technicians'] })
			setTechForm({ name: '', skills: '', phone: '', email: '' })
		},
	})

	const [bayForm, setBayForm] = useState({ key: '', name: '' })
	const baysQuery = useQuery({
		queryKey: ['bays'],
		queryFn: async () => (await api.get<Bay[]>('/api/bays')).data,
	})
	const createBay = useMutation({
		mutationFn: async () => api.post('/api/bays', bayForm),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['bays'] })
			setBayForm({ key: '', name: '' })
		},
	})

	const [companyForm, setCompanyForm] = useState({
		name: '',
		contact: '',
		phone: '',
	})
	const companiesQuery = useQuery({
		queryKey: ['companies'],
		queryFn: async () => (await api.get<Company[]>('/api/companies')).data,
	})
	const createCompany = useMutation({
		mutationFn: async () => api.post('/api/companies', companyForm),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['companies'] })
			setCompanyForm({ name: '', contact: '', phone: '' })
		},
	})

	const [vehicleForm, setVehicleForm] = useState({
		company_id: '',
		type: 'truck',
		vin: '',
		plate: '',
		make: '',
		model: '',
		year: new Date().getFullYear(),
	})
	const vehiclesQuery = useQuery({
		queryKey: ['vehicles'],
		queryFn: async () => (await api.get<Vehicle[]>('/api/vehicles')).data,
	})
	const createVehicle = useMutation({
		mutationFn: async () => api.post('/api/vehicles', vehicleForm),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['vehicles'] })
			setVehicleForm({
				company_id: '',
				type: 'truck',
				vin: '',
				plate: '',
				make: '',
				model: '',
				year: new Date().getFullYear(),
			})
		},
	})

	return (
		<div className='space-y-4'>
			<h1 className='text-xl font-semibold text-slate-900'>Directory</h1>
			<div className='grid gap-4 lg:grid-cols-2'>
				{/* Services section removed */}

				<SectionCard title='Technicians'>
					<div className='grid gap-2 sm:grid-cols-2'>
						<input
							value={techForm.name}
							onChange={e => setTechForm({ ...techForm, name: e.target.value })}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Name'
						/>
						<input
							value={techForm.skills}
							onChange={e =>
								setTechForm({ ...techForm, skills: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Skills comma-separated'
						/>
						<input
							value={techForm.phone}
							onChange={e =>
								setTechForm({ ...techForm, phone: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Phone'
						/>
						<input
							value={techForm.email}
							onChange={e =>
								setTechForm({ ...techForm, email: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Email'
						/>
					</div>
					<div className='flex justify-between text-sm text-slate-600'>
						<span>Total: {techniciansQuery.data?.length ?? 0}</span>
						<button
							type='button'
							onClick={() => createTech.mutate()}
							className='rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white'
						>
							Add
						</button>
					</div>
					<div className='space-y-2 text-sm'>
						{techniciansQuery.data?.map(t => (
							<div key={t.id} className='rounded-md bg-slate-50 px-3 py-2'>
								<div className='font-medium text-slate-900'>{t.name}</div>
								<div className='text-xs text-slate-600'>
									{t.skills.join(', ') || '—'} · {t.phone} · {t.email}
								</div>
							</div>
						))}
					</div>
				</SectionCard>

				<SectionCard title='Bays'>
					<div className='grid gap-2 sm:grid-cols-2'>
						<input
							value={bayForm.name}
							onChange={e => setBayForm({ ...bayForm, name: e.target.value })}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Name'
						/>
						<input
							value={bayForm.key}
							onChange={e => setBayForm({ ...bayForm, key: e.target.value })}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Key'
						/>
					</div>
					<div className='flex justify-between text-sm text-slate-600'>
						<span>Total: {baysQuery.data?.length ?? 0}</span>
						<button
							type='button'
							onClick={() => createBay.mutate()}
							className='rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white'
						>
							Add
						</button>
					</div>
					<div className='space-y-2 text-sm'>
						{baysQuery.data?.map(b => (
							<div key={b.id} className='rounded-md bg-slate-50 px-3 py-2'>
								<div className='font-medium text-slate-900'>{b.name}</div>
								<div className='text-xs text-slate-600'>Key: {b.key}</div>
							</div>
						))}
					</div>
				</SectionCard>

				<SectionCard title='Companies/clients'>
					<div className='grid gap-2 sm:grid-cols-2'>
						<input
							value={companyForm.name}
							onChange={e =>
								setCompanyForm({ ...companyForm, name: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Company name'
						/>
						<input
							value={companyForm.contact}
							onChange={e =>
								setCompanyForm({ ...companyForm, contact: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Contact person'
						/>
						<input
							value={companyForm.phone}
							onChange={e =>
								setCompanyForm({ ...companyForm, phone: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Phone'
						/>
					</div>
					<div className='flex justify-between text-sm text-slate-600'>
						<span>Total: {companiesQuery.data?.length ?? 0}</span>
						<button
							type='button'
							onClick={() => createCompany.mutate()}
							className='rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white'
						>
							Add
						</button>
					</div>
					<div className='space-y-2 text-sm'>
						{companiesQuery.data?.map(c => (
							<div key={c.id} className='rounded-md bg-slate-50 px-3 py-2'>
								<div className='font-medium text-slate-900'>{c.name}</div>
								<div className='text-xs text-slate-600'>
									{c.contact} · {c.phone}
								</div>
							</div>
						))}
					</div>
				</SectionCard>

				<SectionCard title='Vehicles (truck/trailer)'>
					<div className='grid gap-2 sm:grid-cols-2'>
						<input
							value={vehicleForm.company_id}
							onChange={e =>
								setVehicleForm({ ...vehicleForm, company_id: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='company_id'
						/>
						<select
							value={vehicleForm.type}
							onChange={e =>
								setVehicleForm({
									...vehicleForm,
									type: e.target.value as Vehicle['type'],
								})
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
						>
							<option value='truck'>Truck</option>
							<option value='trailer'>Trailer</option>
						</select>
						<input
							value={vehicleForm.vin}
							onChange={e =>
								setVehicleForm({ ...vehicleForm, vin: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='VIN'
						/>
						<input
							value={vehicleForm.plate}
							onChange={e =>
								setVehicleForm({ ...vehicleForm, plate: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Plate'
						/>
						<input
							value={vehicleForm.make}
							onChange={e =>
								setVehicleForm({ ...vehicleForm, make: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Make'
						/>
						<input
							value={vehicleForm.model}
							onChange={e =>
								setVehicleForm({ ...vehicleForm, model: e.target.value })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Model'
						/>
						<input
							type='number'
							value={vehicleForm.year}
							onChange={e =>
								setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })
							}
							className='rounded-lg border border-slate-200 px-3 py-2 text-sm'
							placeholder='Year'
						/>
					</div>
					<div className='flex justify-between text-sm text-slate-600'>
						<span>Total: {vehiclesQuery.data?.length ?? 0}</span>
						<button
							type='button'
							onClick={() => createVehicle.mutate()}
							className='rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white'
						>
							Add
						</button>
					</div>
					<div className='space-y-2 text-sm'>
						{vehiclesQuery.data?.map(v => (
							<div key={v.id} className='rounded-md bg-slate-50 px-3 py-2'>
								<div className='font-medium text-slate-900'>
									{v.type.toUpperCase()} · {v.plate} · {v.vin}
								</div>
								<div className='text-xs text-slate-600'>
									{v.make} {v.model} {v.year} · company {v.company_id}
								</div>
							</div>
						))}
					</div>
				</SectionCard>
			</div>
		</div>
	)
}

export default DirectoryPage
