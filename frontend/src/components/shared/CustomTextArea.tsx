import type { ChangeEvent, ReactNode, TextareaHTMLAttributes } from 'react'

type Props = {
	label?: ReactNode
	value: string
	onChange: (value: string) => void
	placeholder?: string
	rows?: number
	name?: string
	error?: string
	helperText?: string
	autoFocus?: boolean
	className?: string
	textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>
}

export default function CustomTextArea({
	label,
	value,
	onChange,
	placeholder,
	rows = 10,
	name,
	error,
	helperText,
	autoFocus,
	className = '',
	textareaProps,
}: Props) {
	const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value)
	}
	return (
		<label className='block text-sm'>
			{label ? (
				<div className='mb-1 font-medium text-slate-700'>{label}</div>
			) : null}
			<textarea
				{...textareaProps}
				name={name}
				value={value}
				onChange={handleChange}
				placeholder={placeholder}
				rows={rows}
				autoFocus={autoFocus}
				className={`w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2 focus:ring-slate-200 ${
					error ? 'border-rose-500' : 'border-slate-200'
				} ${className}`}
			/>
			{helperText ? (
				<div className='mt-1 text-xs text-slate-500'>{helperText}</div>
			) : null}
			{error ? <div className='mt-1 text-xs text-rose-600'>{error}</div> : null}
		</label>
	)
}
