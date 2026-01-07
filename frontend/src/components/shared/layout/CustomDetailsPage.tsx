import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CustomTabs from './CustomTabs'

type Row = { label: string; value?: ReactNode }

export default function CustomDetailsPage({
	title,
	subtitle,
	rows,
	tabs = ['general', 'logs'],
	renderLogs,
	renderContacts,
	renderUnits,
}: {
	title: ReactNode
	subtitle?: ReactNode
	rows: Row[]
	tabs?: Array<'general' | 'contacts' | 'units' | 'logs'>
	renderLogs?: () => ReactNode
	renderContacts?: () => ReactNode
	renderUnits?: () => ReactNode
}) {
	const navigate = useNavigate()
	const [search] = useSearchParams()
	const active = search.get('tab') ?? 'general'

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-xl font-semibold text-slate-900'>{title}</h1>
					{subtitle ? (
						<p className='text-sm text-slate-600'>{subtitle}</p>
					) : null}
				</div>
				<button
					type='button'
					onClick={() => navigate(-1)}
					className='inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
				>
					<ChevronLeftIcon className='h-4 w-4' />
					Back
				</button>
			</div>
			<CustomTabs
				tabs={tabs.map(t => ({
					key: t,
					label:
						t === 'general'
							? 'General'
							: t === 'contacts'
							? 'Contacts'
							: t === 'units'
							? 'Units'
							: 'Logs',
				}))}
			/>
			{active === 'general' ? (
				<section className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
					<div className='grid gap-6 sm:grid-cols-2'>
						<div className='space-y-3'>
							{rows.slice(0, Math.ceil(rows.length / 2)).map((r, idx) => (
								<div key={idx} className='grid grid-cols-3 text-sm'>
									<div className='col-span-1 text-slate-500'>{r.label}</div>
									<div className='col-span-2 font-medium text-slate-900'>
										{r.value ?? '—'}
									</div>
								</div>
							))}
						</div>
						<div className='space-y-3'>
							{rows.slice(Math.ceil(rows.length / 2)).map((r, idx) => (
								<div key={idx} className='grid grid-cols-3 text-sm'>
									<div className='col-span-1 text-slate-500'>{r.label}</div>
									<div className='col-span-2 font-medium text-slate-900'>
										{r.value ?? '—'}
									</div>
								</div>
							))}
						</div>
					</div>
				</section>
			) : active === 'contacts' ? (
				<section className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
					{renderContacts ? (
						renderContacts()
					) : (
						<p className='text-sm text-slate-600'>No contacts yet.</p>
					)}
				</section>
			) : active === 'units' ? (
				<section className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
					{renderUnits ? (
						renderUnits()
					) : (
						<p className='text-sm text-slate-600'>No units yet.</p>
					)}
				</section>
			) : (
				<section className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
					{renderLogs ? (
						renderLogs()
					) : (
						<p className='text-sm text-slate-600'>No logs yet.</p>
					)}
				</section>
			)}
		</div>
	)
}
