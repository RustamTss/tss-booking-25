import { Transition } from '@headlessui/react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
	content: string
	children: React.ReactNode
	placement?: 'top' | 'bottom'
}

export default function CustomTooltip({
	content,
	children,
	placement = 'top',
}: Props) {
	const [open, setOpen] = useState(false)
	const isTop = placement === 'top'
	const anchorRef = useRef<HTMLSpanElement | null>(null)
	const [coords, setCoords] = useState<{ left: number; top: number } | null>(
		null
	)

	useEffect(() => {
		if (!open) return
		const update = () => {
			const el = anchorRef.current
			if (!el) return
			const r = el.getBoundingClientRect()
			const left = r.left + r.width / 2
			const gap = 8
			const top = isTop ? r.top - gap : r.bottom + gap
			setCoords({ left, top })
		}
		update()
		window.addEventListener('scroll', update, true)
		window.addEventListener('resize', update)
		return () => {
			window.removeEventListener('scroll', update, true)
			window.removeEventListener('resize', update)
		}
	}, [open, isTop])

	return (
		<span
			ref={anchorRef}
			className='relative inline-block'
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
			onFocus={() => setOpen(true)}
			onBlur={() => setOpen(false)}
		>
			{children}
			{typeof document !== 'undefined'
				? createPortal(
						<Transition
							as={Fragment}
							show={open && Boolean(coords)}
							enter='transition ease-out duration-100'
							enterFrom='opacity-0 translate-y-1'
							enterTo='opacity-100 translate-y-0'
							leave='transition ease-in duration-75'
							leaveFrom='opacity-100 translate-y-0'
							leaveTo='opacity-0 translate-y-1'
						>
							<div
								className='fixed z-[9999] -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white shadow-lg'
								role='tooltip'
								style={{
									left: coords?.left ?? 0,
									top: coords?.top ?? 0,
									pointerEvents: 'none',
								}}
							>
								{content}
							</div>
						</Transition>,
						document.body
				  )
				: null}
		</span>
	)
}
