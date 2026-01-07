import { Switch } from '@headlessui/react'
import type { ReactNode } from 'react'

type Props = {
	checked: boolean
	onChange: (checked: boolean) => void
	label?: ReactNode
	description?: ReactNode
	className?: string
}

export default function CustomSwitch({
	checked,
	onChange,
	label,
	description,
	className = '',
}: Props) {
	return (
		<div className={`flex items-center justify-between ${className}`}>
			<div className='mr-4'>
				{label ? (
					<div className='text-sm font-medium text-slate-900'>{label}</div>
				) : null}
				{description ? (
					<div className='text-xs text-slate-600'>{description}</div>
				) : null}
			</div>
			<Switch
				checked={checked}
				onChange={onChange}
				className={`${
					checked ? 'bg-emerald-600' : 'bg-slate-300'
				} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition`}
			>
				<span
					className={`${
						checked ? 'translate-x-6' : 'translate-x-1'
					} inline-block h-4 w-4 transform rounded-full bg-white transition`}
				/>
			</Switch>
		</div>
	)
}
