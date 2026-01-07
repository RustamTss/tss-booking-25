import { CheckIcon, PlusIcon } from '@heroicons/react/24/outline'
import type { Vehicle } from '../../types'
import CustomAutocomplete from '../shared/CustomAutocomplete'
import CustomInput from '../shared/CustomInput'
import CustomModal from '../shared/CustomModal'
import CustomSelect from '../shared/CustomSelect'

type UnitForm = {
	company_id: string
	type: Vehicle['type']
	vin: string
	plate: string
	make: string
	model: string
	year: number
}

type CompanyOption = { id: string; name: string }

type Props = {
	isOpen: boolean
	mode: 'create' | 'edit'
	isSaving: boolean
	form: UnitForm
	companies: CompanyOption[]
	showCompany?: boolean
	onChange: (patch: Partial<UnitForm>) => void
	onCancel: () => void
	onSubmit: () => void
}

export default function UnitQuickModal({
	isOpen,
	mode,
	isSaving,
	form,
	companies,
	showCompany = true,
	onChange,
	onCancel,
	onSubmit,
}: Props) {
	return (
		<CustomModal
			isOpen={isOpen}
			onClose={onCancel}
			title={mode === 'edit' ? 'Edit unit' : 'Create unit'}
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
				{showCompany ? (
					<CustomAutocomplete<string>
						label='Company'
						required
						value={
							form.company_id
								? {
										label:
											companies.find(c => c.id === form.company_id)?.name || '',
										value: form.company_id,
								  }
								: undefined
						}
						onChange={opt => onChange({ company_id: opt.value })}
						options={companies.map(c => ({ label: c.name, value: c.id }))}
						placeholder='Select company'
					/>
				) : null}
				<div className={!showCompany ? 'sm:col-span-2' : ''}>
					<CustomSelect<Vehicle['type']>
						label='Type'
						required
						value={{ label: form.type, value: form.type }}
						onChange={opt => onChange({ type: opt.value })}
						options={[
							{ label: 'Truck', value: 'truck' },
							{ label: 'Trailer', value: 'trailer' },
						]}
					/>
				</div>
				<CustomInput
					label='VIN'
					value={form.vin}
					onChange={v => onChange({ vin: v })}
					placeholder='VIN'
				/>
				<CustomInput
					label='Plate'
					value={form.plate}
					onChange={v => onChange({ plate: v })}
					placeholder='Plate'
				/>
				<CustomInput
					label='Make'
					value={form.make}
					onChange={v => onChange({ make: v })}
					placeholder='Make'
				/>
				<CustomInput
					label='Model'
					value={form.model}
					onChange={v => onChange({ model: v })}
					placeholder='Model'
				/>
				<CustomInput
					label='Year'
					value={form.year}
					type='number'
					onChange={v =>
						onChange({ year: Number(v) || new Date().getFullYear() })
					}
					placeholder='Year'
				/>
			</div>
		</CustomModal>
	)
}
