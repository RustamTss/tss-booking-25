import { Transition } from '@headlessui/react'
import type { ReactNode } from 'react'
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from 'react'

type Toast = { id: number; type: 'success' | 'error'; message: string }

type ToastContextValue = {
	success: (msg: string) => void
	error: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])
	const idRef = useRef(1)

	const push = useCallback((type: Toast['type'], message: string) => {
		const id = idRef.current++
		setToasts(prev => [...prev, { id, type, message }])
		// auto dismiss
		setTimeout(() => {
			setToasts(prev => prev.filter(t => t.id !== id))
		}, 3000)
	}, [])

	const value = useMemo<ToastContextValue>(
		() => ({
			success: m => push('success', m),
			error: m => push('error', m),
		}),
		[push]
	)

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div className='pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2'>
				{toasts.map(t => (
					<Transition
						key={t.id}
						appear
						show
						enter='transform transition duration-200'
						enterFrom='opacity-0 translate-y-2'
						enterTo='opacity-100 translate-y-0'
						leave='transition duration-150'
						leaveFrom='opacity-100'
						leaveTo='opacity-0'
					>
						<div
							className={`pointer-events-auto rounded-md border px-4 py-3 shadow-lg ${
								t.type === 'success'
									? 'bg-emerald-50 border-emerald-200 text-emerald-900'
									: 'bg-rose-50 border-rose-200 text-rose-900'
							}`}
						>
							{t.message}
						</div>
					</Transition>
				))}
			</div>
		</ToastContext.Provider>
	)
}

export function useToast(): ToastContextValue {
	const ctx = useContext(ToastContext)
	if (!ctx) throw new Error('useToast must be used within ToastProvider')
	return ctx
}
