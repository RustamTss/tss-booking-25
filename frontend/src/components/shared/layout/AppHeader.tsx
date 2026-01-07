import { Menu, Transition } from '@headlessui/react'
import {
	ArrowRightOnRectangleIcon,
	BuildingOffice2Icon,
	BuildingOfficeIcon,
	ChevronDownIcon,
	TruckIcon,
	UserGroupIcon,
	UserIcon,
} from '@heroicons/react/24/outline'
import { Fragment } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../ui/ToastProvider'

const navLinkClass =
	'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 [&.active]:bg-slate-900 [&.active]:text-white'

export default function AppHeader() {
	const { logout, role } = useAuth()
	const { success } = useToast()
	return (
		<header className='border-b bg-white'>
			<div className='mx-auto flex max-w-6xl items-center justify-between px-4 py-3'>
				<div className='flex items-center gap-3'>
					<span className='text-lg font-semibold text-slate-900'>TSS SHOP</span>
					<span className='rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'>
						role: {role ?? 'n/a'}
					</span>
				</div>
				<nav className='flex items-center gap-1'>
					<NavLink to='/' end className={navLinkClass} aria-label='Dashboard'>
						Dashboard
					</NavLink>
					<NavLink
						to='/calendar'
						className={navLinkClass}
						aria-label='Calendar'
					>
						Calendar
					</NavLink>
					<NavLink
						to='/bookings'
						className={navLinkClass}
						aria-label='Bookings'
					>
						Bookings
					</NavLink>
					<Menu as='div' className='relative inline-block text-left'>
						<Menu.Button className={`${navLinkClass} flex items-center`}>
							Directory
							<ChevronDownIcon className='h-4 w-4' />
						</Menu.Button>
						<Transition
							as={Fragment}
							enter='transition ease-out duration-100'
							enterFrom='transform opacity-0 scale-95'
							enterTo='transform opacity-100 scale-100'
							leave='transition ease-in duration-75'
							leaveFrom='transform opacity-100 scale-100'
							leaveTo='transform opacity-0 scale-95'
						>
							<Menu.Items className='absolute right-0 z-10 mt-2 w-52 origin-top-right rounded-md border border-slate-200 bg-white shadow-lg focus:outline-none'>
								<div className='py-1 text-sm text-slate-800'>
									{role === 'admin' && (
										<Menu.Item>
											{({ active }) => (
												<Link
													to='/users'
													className={`flex items-center gap-2 px-3 py-2 ${
														active ? 'bg-slate-100' : ''
													}`}
												>
													<UserIcon className='h-4 w-4' />
													Users
												</Link>
											)}
										</Menu.Item>
									)}
									<Menu.Item>
										{({ active }) => (
											<Link
												to='/technicians'
												className={`flex items-center gap-2 px-3 py-2 ${
													active ? 'bg-slate-100' : ''
												}`}
											>
												<UserGroupIcon className='h-4 w-4' />
												Technicians
											</Link>
										)}
									</Menu.Item>
									<Menu.Item>
										{({ active }) => (
											<Link
												to='/bays'
												className={`flex items-center gap-2 px-3 py-2 ${
													active ? 'bg-slate-100' : ''
												}`}
											>
												<BuildingOffice2Icon className='h-4 w-4' />
												Bays
											</Link>
										)}
									</Menu.Item>
									<Menu.Item>
										{({ active }) => (
											<Link
												to='/companies'
												className={`flex items-center gap-2 px-3 py-2 ${
													active ? 'bg-slate-100' : ''
												}`}
											>
												<BuildingOfficeIcon className='h-4 w-4' />
												Companies
											</Link>
										)}
									</Menu.Item>
									<Menu.Item>
										{({ active }) => (
											<Link
												to='/vehicles'
												className={`flex items-center gap-2 px-3 py-2 ${
													active ? 'bg-slate-100' : ''
												}`}
											>
												<TruckIcon className='h-4 w-4' />
												Units
											</Link>
										)}
									</Menu.Item>
								</div>
							</Menu.Items>
						</Transition>
					</Menu>
					{role === 'admin' && (
						<NavLink to='/logs' className={navLinkClass} aria-label='Logs'>
							Logs
						</NavLink>
					)}
					{role === 'admin' && (
						<NavLink
							to='/settings'
							className={navLinkClass}
							aria-label='Settings'
						>
							Settings
						</NavLink>
					)}
				</nav>
				<div className='flex items-center gap-2'>
					<NavLink
						to='/profile'
						className='inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
					>
						<UserIcon className='h-4 w-4' />
						Profile
					</NavLink>
					<button
						type='button'
						onClick={() => {
							logout()
							success('Signed out')
						}}
						className='inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800'
						aria-label='Log out'
					>
						<ArrowRightOnRectangleIcon className='h-4 w-4' />
						Log out
					</button>
				</div>
			</div>
		</header>
	)
}
