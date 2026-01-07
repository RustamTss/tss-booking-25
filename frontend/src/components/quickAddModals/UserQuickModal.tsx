import { CheckIcon, PlusIcon } from '@heroicons/react/24/outline'
import type { UserRole } from '../../types'
import CustomInput from '../shared/CustomInput'
import CustomModal from '../shared/CustomModal'
import CustomSelect from '../shared/CustomSelect'
import CustomSwitch from '../shared/CustomSwitch'

type UserForm = {
	email: string
	password: string
	role: UserRole
	status: 'active' | 'inactive'
}

type Props = {
	isOpen: boolean
	mode: 'create' | 'edit'
	isSaving: boolean
	form: UserForm
	roles: UserRole[]
	onChange: (patch: Partial<UserForm>) => void
	onCancel: () => void
	onSubmit: () => void
}

export default function UserQuickModal({
	isOpen,
	mode,
	isSaving,
	form,
	roles,
	onChange,
	onCancel,
	onSubmit,
}: Props) {
	return (
		<CustomModal
			isOpen={isOpen}
			onClose={onCancel}
			title={mode === 'edit' ? 'Edit user' : 'Create user'}
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
						{mode === 'edit' ? (
							<>
								<CheckIcon className='h-4 w-4' />
								{isSaving ? 'Saving...' : 'Save'}
							</>
						) : (
							<>
								<PlusIcon className='h-4 w-4' />
								{isSaving ? 'Creating...' : 'Create'}
							</>
						)}
					</button>
				</div>
			}
		>
			<div className='grid gap-3 sm:grid-cols-2'>
				<CustomInput
					label='Email'
					value={form.email}
					onChange={v => onChange({ email: v })}
					placeholder='email@example.com'
					autoFocus
				/>
				<CustomInput
					label={mode === 'edit' ? 'New password (optional)' : 'Password'}
					value={form.password}
					onChange={v => onChange({ password: v })}
					placeholder='******'
				/>
				<CustomSelect<UserRole>
					label='Role'
					required
					value={{
						label: form.role,
						value: form.role,
					}}
					onChange={opt => onChange({ role: opt.value })}
					options={roles.map(r => ({ label: r, value: r }))}
					placeholder='Select role'
				/>
				<div className='pt-2'>
					<CustomSwitch
						checked={form.status === 'active'}
						onChange={v => onChange({ status: v ? 'active' : 'inactive' })}
						label='Active status'
						description='Toggle to activate or deactivate the user'
					/>
				</div>
			</div>
		</CustomModal>
	)
}
