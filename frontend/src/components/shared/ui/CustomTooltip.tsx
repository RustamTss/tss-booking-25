import { Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'

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
	return (
		<div
			className='relative inline-block'
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
			onFocus={() => setOpen(true)}
			onBlur={() => setOpen(false)}
		>
			{children}
			<Transition
				as={Fragment}
				show={open}
				enter='transition ease-out duration-100'
				enterFrom='opacity-0 translate-y-1'
				enterTo='opacity-100 translate-y-0'
				leave='transition ease-in duration-75'
				leaveFrom='opacity-100 translate-y-0'
				leaveTo='opacity-0 translate-y-1'
			>
				<div
					className={`absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white ${
						isTop ? 'bottom-full mb-2' : 'top-full mt-2'
					}`}
					role='tooltip'
				>
					{content}
				</div>
			</Transition>
		</div>
	)
}
