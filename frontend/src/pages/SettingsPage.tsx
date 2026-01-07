import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import CustomInput from '../components/shared/CustomInput'
import CustomTextArea from '../components/shared/CustomTextArea'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { TelegramSettings } from '../types'

// Users moved to dedicated UsersPage

function SettingsPage() {
	const qc = useQueryClient()
	const { success, error } = useToast()

	const settingsQuery = useQuery({
		queryKey: ['settings', 'telegram'],
		queryFn: async () =>
			(await api.get<TelegramSettings>('/api/settings/telegram')).data,
	})
	const [tgForm, setTgForm] = useState({
		telegram_token: '',
		telegram_chat: '',
		telegram_template: '',
	})
	// preview removed per request
	// Resolve current values (existing settings as base, local edits override)
	const resolvedToken =
		tgForm.telegram_token || settingsQuery.data?.telegram_token || ''
	const resolvedChat =
		tgForm.telegram_chat || settingsQuery.data?.telegram_chat || ''
	const resolvedTemplate =
		tgForm.telegram_template || settingsQuery.data?.telegram_template || ''

	const saveTg = useMutation({
		mutationFn: async () =>
			api.put('/api/settings/telegram', {
				telegram_token: resolvedToken,
				telegram_chat: resolvedChat,
				telegram_template: resolvedTemplate,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['settings', 'telegram'] })
			success('Telegram settings saved')
		},
		onError: () => error('Failed to save Telegram settings'),
	})
	// preview removed

	// Users section removed (migrated to UsersPage)

	return (
		<div className='space-y-6'>
			<div>
				<h1 className='text-xl font-semibold text-slate-900'>Settings</h1>
				<p className='text-sm text-slate-600'>
					Telegram notifications and users
				</p>
			</div>

			<section className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
				<div className='flex items-center gap-2'>
					<PaperAirplaneIcon className='h-4 w-4 text-slate-600' />
					<h2 className='text-sm font-semibold text-slate-900'>Telegram</h2>
				</div>
				<div className='mt-3 grid gap-3 sm:grid-cols-2'>
					<CustomInput
						label='Telegram bot token'
						value={resolvedToken}
						onChange={v => setTgForm(p => ({ ...p, telegram_token: v }))}
						placeholder='1234:AA...'
					/>
					<CustomInput
						label='Chat ID'
						value={resolvedChat}
						onChange={v => setTgForm(p => ({ ...p, telegram_chat: v }))}
						placeholder='-100...'
					/>
				</div>
				<div className='mt-4'>
					<CustomTextArea
						label='Telegram template'
						value={resolvedTemplate}
						onChange={v => setTgForm(p => ({ ...p, telegram_template: v }))}
						rows={14}
						placeholder={
							'Booking #{booking_id}\nComplaint: {complaint}\nUnit: {unit}\nDate: {start} {end}\nFullbay Service ID: {fullbay_service_id}'
						}
						helperText='Use placeholders like {booking_id}, {complaint}, {unit}, {fullbay_service_id}, {bay_name}, {start}'
					/>
					<div className='mt-2 flex flex-wrap gap-2 text-xs'>
						{[
							'booking_id',
							'complaint',
							'description',
							'status',
							'start',
							'end',
							'bay_name',
							'company_name',
							'unit',
							'unit_plate',
							'unit_vin',
							'unit_make',
							'unit_model',
							'fullbay_service_id',
							'technician_names',
						].map(key => (
							<button
								key={key}
								type='button'
								onClick={() =>
									setTgForm(p => ({
										...p,
										telegram_template:
											(p.telegram_template || '') +
											(p.telegram_template?.endsWith(' ')
												? ''
												: p.telegram_template
												? ' '
												: '') +
											`{${key}}`,
									}))
								}
								className='rounded-md border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50'
								aria-label={`Insert {${key}}`}
							>
								{`{${key}}`}
							</button>
						))}
					</div>
				</div>
				<div className='mt-3 flex justify-end'>
					<button
						type='button'
						onClick={() => saveTg.mutate()}
						disabled={saveTg.isPending}
						className='inline-flex w-28 items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60'
					>
						{saveTg.isPending ? 'Saving...' : 'Save'}
					</button>
				</div>
			</section>

			{/* Users section moved to UsersPage */}
		</div>
	)
}

export default SettingsPage
