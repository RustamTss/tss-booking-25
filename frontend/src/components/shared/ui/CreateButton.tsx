import { PlusIcon } from '@heroicons/react/24/outline'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
	children?: ReactNode
}

export default function CreateButton({
	children,
	className = '',
	...rest
}: Props) {
	return (
		<button
			type='button'
			{...rest}
			className={`inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 ${className}`}
		>
			<PlusIcon className='h-4 w-4' />
			{children}
		</button>
	)
}
