import { useSearchParams } from 'react-router-dom'

type Tab = { key: string; label: string }

export default function CustomTabs({ tabs }: { tabs: Tab[] }) {
	const [search, setSearch] = useSearchParams()
	const active = search.get('tab') ?? tabs[0]?.key
	const handleClick = (key: string) => {
		search.set('tab', key)
		setSearch(search, { replace: true })
	}
	return (
		<div className='border-b border-slate-200'>
			<nav className='-mb-px flex gap-4' aria-label='Tabs'>
				{tabs.map(t => (
					<button
						key={t.key}
						onClick={() => handleClick(t.key)}
						className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
							active === t.key
								? 'border-slate-900 text-slate-900'
								: 'border-transparent text-slate-600 hover:text-slate-900'
						}`}
					>
						{t.label}
					</button>
				))}
			</nav>
		</div>
	)
}
