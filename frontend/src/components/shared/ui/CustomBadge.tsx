type Props = {
	label: string
	variant?: 'create' | 'update' | 'assign'
	className?: string
}

export default function CustomBadge({
	label,
	variant = 'create',
	className = '',
}: Props) {
	const palette =
		variant === 'create'
			? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
			: variant === 'update'
			? 'bg-amber-100 text-amber-800 ring-amber-200'
			: 'bg-sky-100 text-sky-800 ring-sky-200'
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${palette} ${className}`}
		>
			{label}
		</span>
	)
}
