import { CheckIcon, PlusIcon } from '@heroicons/react/24/outline'
import CustomInput from '../shared/CustomInput'
import CustomModal from '../shared/CustomModal'

type CompanyForm = {
	name: string
	contact: string
	phone: string
}

type Props = {
	isOpen: boolean
	mode: 'create' | 'edit'
	isSaving: boolean
	form: CompanyForm
	onChange: (patch: Partial<CompanyForm>) => void
	onCancel: () => void
	onSubmit: () => void
}

export default function CompanyQuickModal({
	isOpen,
	mode,
	isSaving,
	form,
	onChange,
	onCancel,
	onSubmit,
}: Props) {
	return (
		<CustomModal
			isOpen={isOpen}
			onClose={onCancel}
			title={mode === 'edit' ? 'Edit company' : 'Create company'}
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
					label='Name'
					value={form.name}
					onChange={v => onChange({ name: v })}
					placeholder='Company name'
					autoFocus
				/>
				<CustomInput
					label='Contact person'
					value={form.contact}
					onChange={v => onChange({ contact: v })}
					placeholder='Name'
				/>
				<CustomInput
					label='Phone'
					value={form.phone}
					onChange={v => onChange({ phone: v })}
					placeholder='Phone'
				/>
			</div>
		</CustomModal>
	)
}
