import { Menu, Transition } from '@headlessui/react'
import { Fragment, useEffect, useMemo, useRef } from 'react'

type CustomMenuDropdownProps = {
	open: boolean
	anchorRect: DOMRect | null
	onClose: () => void
	width?: number
	children: React.ReactNode
	title?: string
}

export default function CustomMenuDropdown({
	open,
	anchorRect,
	onClose,
	width = 320,
	children,
	title,
}: CustomMenuDropdownProps) {
	const btnRef = useRef<HTMLButtonElement | null>(null)

	// Auto-toggle the menu open when the component mounts with open=true
	useEffect(() => {
		if (!open) return
		const id = window.setTimeout(() => {
			btnRef.current?.click()
		}, 0)
		return () => window.clearTimeout(id)
	}, [open])

	const position = useMemo(() => {
		if (!anchorRect) return null
		const top = anchorRect.bottom + 8
		const left = Math.min(anchorRect.left, window.innerWidth - (width + 20))
		return { top, left }
	}, [anchorRect, width])

	if (!open || !position) return null

	return (
		<>
			{/* Scrim to support outside click closing even if items overflow */}
			<div className='fixed inset-0 z-40' onClick={onClose} />
			<div
				className='fixed z-50'
				style={{ top: position.top, left: position.left, width }}
			>
				<Menu as='div' className='relative w-full'>
					{({ open: internalOpen }) => (
						<>
							<Menu.Button
								ref={btnRef}
								className='sr-only'
								aria-label='Open dropdown'
							/>
							<Transition
								as={Fragment}
								show={internalOpen}
								enter='transition ease-out duration-150'
								enterFrom='opacity-0 translate-y-1'
								enterTo='opacity-100 translate-y-0'
								leave='transition ease-in duration-100'
								leaveFrom='opacity-100 translate-y-0'
								leaveTo='opacity-0 translate-y-1'
								afterLeave={onClose}
							>
								<Menu.Items className='max-h-[60vh] w-full overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg focus:outline-none'>
									{title ? (
										<div className='px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500'>
											{title}
										</div>
									) : null}
									{children}
								</Menu.Items>
							</Transition>
						</>
					)}
				</Menu>
			</div>
		</>
	)
}
