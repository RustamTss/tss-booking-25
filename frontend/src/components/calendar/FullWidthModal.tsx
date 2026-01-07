import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import { Fragment } from 'react'

type FullWidthModalProps = {
	isOpen: boolean
	onClose: () => void
	title?: string
	children: ReactNode
}

export default function FullWidthModal({
	isOpen,
	onClose,
	title,
	children,
}: FullWidthModalProps) {
	return (
		<Transition.Root show={isOpen} as={Fragment}>
			<Dialog as='div' className='relative z-50' onClose={onClose}>
				<Transition.Child
					as={Fragment}
					enter='ease-out duration-200'
					enterFrom='opacity-0'
					enterTo='opacity-100'
					leave='ease-in duration-150'
					leaveFrom='opacity-100'
					leaveTo='opacity-0'
				>
					<div className='fixed inset-0 bg-black/50' />
				</Transition.Child>

				<div className='fixed inset-0 overflow-hidden'>
					<div className='flex h-full w-full items-stretch justify-center'>
						<Transition.Child
							as={Fragment}
							enter='ease-out duration-200'
							enterFrom='opacity-0 scale-95'
							enterTo='opacity-100 scale-100'
							leave='ease-in duration-150'
							leaveFrom='opacity-100 scale-100'
							leaveTo='opacity-0 scale-95'
						>
							<Dialog.Panel className='relative m-0 flex h-screen w-screen flex-col bg-white'>
								<div className='flex items-center justify-between border-b border-slate-200 px-4 py-3'>
									<Dialog.Title className='text-sm font-semibold text-slate-900'>
										{title || 'Schedule'}
									</Dialog.Title>
									<button
										type='button'
										onClick={onClose}
										className='rounded-md p-1 text-slate-600 hover:bg-slate-100'
										aria-label='Close'
									>
										<XMarkIcon className='h-5 w-5' />
									</button>
								</div>
								<div className='flex-1 overflow-hidden'>
									<div className='h-full w-full'>{children}</div>
								</div>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</div>
			</Dialog>
		</Transition.Root>
	)
}
