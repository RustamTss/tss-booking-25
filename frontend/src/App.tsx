//
import {
	QueryClient,
	QueryClientProvider,
	useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import {
	BrowserRouter,
	Navigate,
	Outlet,
	Route,
	Routes,
} from 'react-router-dom'
import AppHeader from './components/shared/layout/AppHeader.tsx'
import { ToastProvider } from './components/shared/ui/ToastProvider'
import { AuthProvider, useAuth } from './context/AuthContext'
import BayDetailsPage from './pages/BayDetailsPage'
import BaysPage from './pages/BaysPage'
import BookingDetailsPage from './pages/BookingDetailsPage'
import BookingsPage from './pages/BookingsPage'
import CalendarPage from './pages/CalendarPage'
import CompaniesPage from './pages/CompaniesPage'
import CompanyDetailsPage from './pages/CompanyDetailsPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import LogsPage from './pages/LogsPage'
import ProfilePage from './pages/ProfilePage.tsx'
import SettingsPage from './pages/SettingsPage'
import TechnicianDetailsPage from './pages/TechnicianDetailsPage'
import TechniciansPage from './pages/TechniciansPage'
import UnitDetailsPage from './pages/UnitDetailsPage'
import UserDetailsPage from './pages/UserDetailsPage'
import UsersPage from './pages/UsersPage'
import VehiclesPage from './pages/VehiclesPage'

const queryClient = new QueryClient()

function WsBridge() {
	const client = useQueryClient()
	const wsUrl = useMemo(() => {
		const api = import.meta.env.VITE_API_URL ?? 'http://localhost:8090'
		try {
			const url = new URL(api)
			url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
			url.pathname = '/ws'
			return url.toString()
		} catch {
			return 'ws://localhost:8090/ws'
		}
	}, [])

	useEffect(() => {
		let ws: WebSocket | null = null
		let retry: number | undefined

		const connect = () => {
			ws = new WebSocket(wsUrl)
			ws.onmessage = event => {
				try {
					const msg = JSON.parse(event.data)
					if (msg?.type?.startsWith('booking.')) {
						client.invalidateQueries({ queryKey: ['agenda'] })
						client.invalidateQueries({ queryKey: ['bookings'] })
						client.invalidateQueries({ queryKey: ['bay-occupancy'] })
					}
				} catch {
					/* ignore parse errors */
				}
			}
			ws.onerror = () => {
				ws?.close()
			}
			ws.onclose = () => {
				retry = window.setTimeout(connect, 3000)
			}
		}

		connect()
		return () => {
			if (retry) {
				clearTimeout(retry)
			}
			ws?.close()
		}
	}, [client, wsUrl])

	return null
}

function ProtectedLayout() {
	const { isAuthenticated } = useAuth()
	if (!isAuthenticated) {
		return <Navigate to='/login' replace />
	}

	return (
		<div className='min-h-screen bg-slate-50'>
			<AppHeader />
			<main className='mx-auto max-w-6xl px-4 py-6'>
				<Outlet />
			</main>
		</div>
	)
}

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<WsBridge />
				<ToastProvider>
					<BrowserRouter>
						<Routes>
							<Route path='/login' element={<LoginPage />} />
							<Route element={<ProtectedLayout />}>
								<Route index element={<DashboardPage />} />
								<Route path='/calendar' element={<CalendarPage />} />
								<Route path='/bookings' element={<BookingsPage />} />
								<Route path='/bookings/:id' element={<BookingDetailsPage />} />
								<Route path='/technicians' element={<TechniciansPage />} />
								<Route
									path='/technicians/:id'
									element={<TechnicianDetailsPage />}
								/>
								<Route path='/bays' element={<BaysPage />} />
								<Route path='/bays/:id' element={<BayDetailsPage />} />
								<Route path='/companies' element={<CompaniesPage />} />
								<Route path='/companies/:id' element={<CompanyDetailsPage />} />
								<Route path='/vehicles' element={<VehiclesPage />} />
								<Route path='/vehicles/:id' element={<UnitDetailsPage />} />
								<Route path='/users' element={<UsersPage />} />
								<Route path='/users/:id' element={<UserDetailsPage />} />
								<Route path='/logs' element={<LogsPage />} />
								<Route path='/profile' element={<ProfilePage />} />
								<Route path='/settings' element={<SettingsPage />} />
							</Route>
							<Route path='*' element={<Navigate to='/' />} />
						</Routes>
					</BrowserRouter>
				</ToastProvider>
			</AuthProvider>
		</QueryClientProvider>
	)
}

export default App
