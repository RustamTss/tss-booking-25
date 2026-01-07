import { TrashIcon } from '@heroicons/react/24/outline'
import type { ReactNode } from 'react'
import CustomModal from '../CustomModal'

type Props = {
	isOpen: boolean
	title?: string
	message?: ReactNode
	onCancel: () => void
	onConfirm: () => void
}

export default function ConfirmDeleteModal({
	isOpen,
	title = 'Delete item',
	message = 'Are you sure you want to delete this item? This action cannot be undone.',
	onCancel,
	onConfirm,
}: Props) {
	return (
		<CustomModal
			isOpen={isOpen}
			onClose={onCancel}
			title={title}
			footer={
				<div className='flex justify-end gap-2'>
					<button
						className='rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
						onClick={onCancel}
					>
						Cancel
					</button>
					<button
						className='inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700'
						onClick={onConfirm}
					>
						<TrashIcon className='h-4 w-4' />
						Delete
					</button>
				</div>
			}
		>
			<div className='text-sm text-slate-700'>{message}</div>
		</CustomModal>
	)
}
