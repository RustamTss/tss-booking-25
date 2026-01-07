import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react'

export type CustomInputProps = {
	label?: ReactNode
	value: string | number
	onChange: (value: string) => void
	type?: InputHTMLAttributes<HTMLInputElement>['type']
	placeholder?: string
	error?: string
	helperText?: string
	name?: string
	autoFocus?: boolean
	required?: boolean
}

export default function CustomInput({
	label,
	value,
	onChange,
	type = 'text',
	placeholder,
	error,
	helperText,
	name,
	autoFocus,
	required = false,
}: CustomInputProps) {
	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.value)
	}

	return (
		<label className='block text-sm'>
			{label ? (
				<div className='mb-1 font-medium text-slate-700'>
					{label}
					{required ? <span className='ml-1 text-rose-600'>*</span> : null}
				</div>
			) : null}
			<input
				name={name}
				value={value}
				onChange={handleChange}
				type={type}
				placeholder={placeholder}
				autoFocus={autoFocus}
				required={required}
				className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2 focus:ring-slate-200 ${
					error ? 'border-rose-500' : 'border-slate-200'
				}`}
			/>
			{helperText ? (
				<div className='mt-1 text-xs text-slate-500'>{helperText}</div>
			) : null}
			{error ? <div className='mt-1 text-xs text-rose-600'>{error}</div> : null}
		</label>
	)
}
