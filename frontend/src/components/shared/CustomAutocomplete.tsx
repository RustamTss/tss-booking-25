import { Combobox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid'
import { Fragment, useMemo, useState } from 'react'

export type AutoOption<T = string> = { label: string; value: T }

type Props<T> = {
	value?: AutoOption<T>
	onChange: (opt: AutoOption<T>) => void
	options: Array<AutoOption<T>>
	onQueryChange?: (q: string) => void
	placeholder?: string
	label?: string
	required?: boolean
}

export default function CustomAutocomplete<T>({
	value,
	onChange,
	options,
	onQueryChange,
	placeholder = 'Search…',
	label,
	required = false,
}: Props<T>) {
	const [query, setQuery] = useState('')
	const filtered = useMemo(() => {
		if (!query || onQueryChange) return options
		const q = query.toLowerCase()
		return options.filter(o => o.label.toLowerCase().includes(q))
	}, [options, query, onQueryChange])

	return (
		<div className='text-sm'>
			{label ? (
				<div className='mb-1 font-medium text-slate-700'>
					{label}
					{required ? <span className='ml-1 text-rose-600'>*</span> : null}
				</div>
			) : null}
			<Combobox
				value={value ?? null}
				onChange={(opt: AutoOption<T> | null) => {
					if (opt) onChange(opt as AutoOption<T>)
				}}
			>
				<div className='relative'>
					<div className='relative w-full cursor-default overflow-hidden rounded-lg bg-white text-left border border-slate-200 focus:outline-none'>
						<Combobox.Input
							className='w-full border-none py-2 pl-3 pr-10 text-sm leading-5 text-slate-900 focus:outline-none'
							displayValue={(opt: AutoOption<T>) => (opt ? opt.label : '')}
							onChange={event => {
								const q = event.target.value
								setQuery(q)
								if (onQueryChange) onQueryChange(q)
							}}
							placeholder={placeholder}
						/>
						<Combobox.Button className='absolute inset-y-0 right-0 flex items-center pr-2'>
							<ChevronUpDownIcon
								className='h-4 w-4 text-slate-400'
								aria-hidden='true'
							/>
						</Combobox.Button>
					</div>
					<Transition
						as={Fragment}
						leave='transition ease-in duration-100'
						leaveFrom='opacity-100'
						leaveTo='opacity-0'
						afterLeave={() => setQuery('')}
					>
						<Combobox.Options className='absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm'>
							{filtered.length === 0 && query !== '' ? (
								<div className='relative cursor-default select-none px-4 py-2 text-slate-700'>
									No results.
								</div>
							) : (
								filtered.map(opt => (
									<Combobox.Option
										key={String((opt as unknown as { value: unknown }).value)}
										className={({ active }) =>
											`relative cursor-default select-none py-2 pl-10 pr-4 ${
												active
													? 'bg-slate-100 text-slate-900'
													: 'text-slate-900'
											}`
										}
										value={opt}
									>
										{({ selected, active }) => (
											<>
												<span
													className={`block truncate ${
														selected ? 'font-medium' : 'font-normal'
													}`}
												>
													{opt.label}
												</span>
												{selected ? (
													<span
														className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
															active ? 'text-slate-900' : 'text-slate-700'
														}`}
													>
														<CheckIcon className='h-4 w-4' aria-hidden='true' />
													</span>
												) : null}
											</>
										)}
									</Combobox.Option>
								))
							)}
						</Combobox.Options>
					</Transition>
				</div>
			</Combobox>
		</div>
	)
}
