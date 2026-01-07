import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export type Column<T> = {
	key: keyof T | string
	header: ReactNode
	render?: (row: T) => ReactNode
	className?: string
}

type Props<T> = {
	columns: Array<Column<T>>
	data: T[]
	rowKey?: (row: T, index: number) => string
	emptyText?: string
	pagination?: boolean
	pageParamKey?: string
}

export default function CustomTable<T extends Record<string, any>>({
	columns,
	data,
	rowKey,
	emptyText = 'No data',
	pagination = true,
	pageParamKey,
}: Props<T>) {
	const [search, setSearch] = useSearchParams()
	const pageKey = `${pageParamKey ? `${pageParamKey}_` : ''}page`
	const limitKey = `${pageParamKey ? `${pageParamKey}_` : ''}limit`
	const limit = Math.max(1, Number(search.get(limitKey) ?? 10))
	const page = Math.max(1, Number(search.get(pageKey) ?? 1))

	const { paged, from, to, total, pages } = useMemo(() => {
		if (!pagination) {
			return {
				paged: data,
				from: 1,
				to: data.length,
				total: data.length,
				pages: 1,
			}
		}
		const total = data.length
		const start = (page - 1) * limit
		const end = Math.min(start + limit, total)
		const slice = data.slice(start, end)
		const pages = Math.max(1, Math.ceil(total / limit))
		return {
			paged: slice,
			from: total === 0 ? 0 : start + 1,
			to: end,
			total,
			pages,
		}
	}, [data, page, limit, pagination])

	const setPage = (next: number) => {
		const p = Math.min(Math.max(1, next), pages)
		const nextParams = new URLSearchParams(search)
		nextParams.set(pageKey, String(p))
		setSearch(nextParams, { replace: true })
	}
	const setLimit = (l: number) => {
		const nextParams = new URLSearchParams(search)
		nextParams.set(limitKey, String(l))
		nextParams.set(pageKey, '1')
		setSearch(nextParams, { replace: true })
	}

	return (
		<div className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'>
			<table className='min-w-full divide-y divide-slate-200'>
				<thead className='bg-slate-50'>
					<tr>
						{columns.map((c, idx) => (
							<th
								key={String(c.key) + idx}
								className={`px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 ${
									c.className ?? ''
								}`}
							>
								{c.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody className='divide-y divide-slate-100'>
					{paged.length === 0 ? (
						<tr>
							<td
								className='px-4 py-6 text-center text-sm text-slate-600'
								colSpan={columns.length}
							>
								{emptyText}
							</td>
						</tr>
					) : (
						paged.map((row, i) => (
							<tr
								key={
									rowKey
										? rowKey(row, i)
										: String(row.id ?? i + (page - 1) * limit)
								}
								className='hover:bg-slate-50'
							>
								{columns.map((c, idx) => (
									<td
										key={String(c.key) + idx}
										className={`px-4 py-2 text-sm text-slate-800 ${
											c.className ?? ''
										}`}
									>
										{c.render
											? c.render(row)
											: String(row[c.key as keyof T] ?? '')}
									</td>
								))}
							</tr>
						))
					)}
				</tbody>
			</table>
			{pagination ? (
				<div className='flex items-center justify-between gap-3 border-top border-slate-200 bg-slate-50 px-4 py-2'>
					<div className='text-sm text-slate-600'>
						{from}–{to} of {total}
					</div>
					<div className='flex items-center gap-3'>
						<label className='text-sm text-slate-600'>
							Rows:
							<select
								className='ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm'
								value={limit}
								onChange={e => setLimit(Number(e.target.value))}
							>
								{[5, 10, 50, 100].map(n => (
									<option key={n} value={n}>
										{n}
									</option>
								))}
							</select>
						</label>
						<div className='flex items-center gap-1'>
							<button
								type='button'
								className='rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 disabled:opacity-40'
								onClick={() => setPage(page - 1)}
								disabled={page <= 1}
							>
								Prev
							</button>
							<span className='text-sm text-slate-700'>
								{page} / {pages}
							</span>
							<button
								type='button'
								className='rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700 disabled:opacity-40'
								onClick={() => setPage(page - 0 + 1)}
								disabled={page >= pages}
							>
								Next
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	)
}
