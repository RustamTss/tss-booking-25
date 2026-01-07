import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid'
import type { ReactNode } from 'react'
import { Fragment } from 'react'

export type Option<T = string> = { label: string; value: T }

type Props<T> = {
	label?: ReactNode
	value?: Option<T> | null
	onChange: (opt: Option<T>) => void
	options: Array<Option<T>>
	placeholder?: string
	required?: boolean
}

export default function CustomSelect<T>({
	label,
	value,
	onChange,
	options,
	placeholder = 'Select...',
	required = false,
}: Props<T>) {
	return (
		<div className='text-sm'>
			{label ? (
				<div className='mb-1 font-medium text-slate-700'>
					{label}
					{required ? <span className='ml-1 text-rose-600'>*</span> : null}
				</div>
			) : null}
			<Listbox value={value ?? undefined} onChange={onChange}>
				<div className='relative'>
					<Listbox.Button className='relative w-full cursor-default rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200'>
						<span className='block truncate'>
							{value ? (
								value.label
							) : (
								<span className='text-slate-400'>{placeholder}</span>
							)}
						</span>
						<span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
							<ChevronUpDownIcon
								className='h-4 w-4 text-slate-400'
								aria-hidden='true'
							/>
						</span>
					</Listbox.Button>
					<Transition
						as={Fragment}
						leave='transition ease-in duration-100'
						leaveFrom='opacity-100'
						leaveTo='opacity-0'
					>
						<Listbox.Options className='absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm'>
							{options.map(opt => (
								<Listbox.Option
									key={String((opt as unknown as { value: unknown }).value)}
									className={({ active }) =>
										`relative cursor-default select-none py-2 pl-10 pr-4 ${
											active ? 'bg-slate-100 text-slate-900' : 'text-slate-900'
										}`
									}
									value={opt}
								>
									{({ selected }) => (
										<>
											<span
												className={`block truncate ${
													selected ? 'font-medium' : 'font-normal'
												}`}
											>
												{opt.label}
											</span>
											{selected ? (
												<span className='absolute inset-y-0 left-0 flex items-center pl-3 text-slate-700'>
													<CheckIcon className='h-4 w-4' aria-hidden='true' />
												</span>
											) : null}
										</>
									)}
								</Listbox.Option>
							))}
						</Listbox.Options>
					</Transition>
				</div>
			</Listbox>
		</div>
	)
}
