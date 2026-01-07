import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import { Fragment } from 'react'

type Props = {
	isOpen: boolean
	onClose: () => void
	title?: ReactNode
	children: ReactNode
	footer?: ReactNode
	maxWidthClassName?: string
}

export default function CustomModal({
	isOpen,
	onClose,
	title,
	children,
	footer,
	maxWidthClassName = 'max-w-lg',
}: Props) {
	return (
		<Transition.Root show={isOpen} as={Fragment}>
			<Dialog as='div' className='relative z-50' onClose={onClose}>
				<Transition.Child
					as={Fragment}
					enter='ease-out cubic-bezier(0.4, 0, 0.2, 1) 200ms'
					enterFrom='opacity-0'
					enterTo='opacity-100'
					leave='ease-in duration-150'
					leaveFrom='opacity-100'
					leaveTo='opacity-0'
				>
					<div className='fixed inset-0 bg-black/40' />
				</Transition.Child>

				<div className='fixed inset-0 z-50 overflow-y-auto'>
					<div className='flex min-h-full items-center justify-center p-4'>
						<Transition.Child
							as={Fragment}
							enter='ease-out duration-200'
							enterFrom='opacity-0 translate-y-2'
							enterTo='opacity-100 translate-y-0'
							leave='ease-in duration-150'
							leaveFrom='opacity-100 translate-y-0'
							leaveTo='opacity-0 translate-y-2'
						>
							<Dialog.Panel
								className={`w-full ${maxWidthClassName} transform overflow-visible rounded-xl bg-white shadow-xl`}
							>
								<div className='flex items-center justify-between border-b border-slate-200 px-4 py-3'>
									<Dialog.Title className='text-sm font-semibold text-slate-900'>
										{title}
									</Dialog.Title>
									<button
										className='rounded-md p-1 text-slate-600 hover:bg-slate-100'
										onClick={onClose}
										aria-label='Close'
									>
										<XMarkIcon className='h-5 w-5' />
									</button>
								</div>
								<div className='p-4'>{children}</div>
								{footer ? (
									<div className='border-t border-slate-200 bg-slate-50 px-4 py-3'>
										{footer}
									</div>
								) : null}
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition.Root>
	)
}
