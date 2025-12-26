import { Fragment, useEffect, useMemo } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, Link } from 'react-router-dom'
import { Menu, Transition } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { AuthProvider, useAuth } from './context/AuthContext'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import CalendarPage from './pages/CalendarPage'
import BookingsPage from './pages/BookingsPage'
import ServicesPage from './pages/ServicesPage'
import TechniciansPage from './pages/TechniciansPage'
import BaysPage from './pages/BaysPage'
import CompaniesPage from './pages/CompaniesPage'
import VehiclesPage from './pages/VehiclesPage'
import SettingsPage from './pages/SettingsPage'

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
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg?.type?.startsWith('booking.')) {
            client.invalidateQueries({ queryKey: ['agenda'] })
            client.invalidateQueries({ queryKey: ['bookings'] })
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

const navLinkClass =
  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 [&.active]:bg-slate-900 [&.active]:text-white'

function ProtectedLayout() {
  const { isAuthenticated, logout, role } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-900">Dayton Truck Repair</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              role: {role ?? 'n/a'}
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navLinkClass} aria-label="Dashboard">
              Дэшборд
            </NavLink>
            <NavLink to="/calendar" className={navLinkClass} aria-label="Calendar">
              Календарь
            </NavLink>
            <NavLink to="/bookings" className={navLinkClass} aria-label="Bookings">
              Бронирования
            </NavLink>
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button className={`${navLinkClass} flex items-center`}>
                Справочники
                <ChevronDownIcon className="h-4 w-4" />
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-52 origin-top-right rounded-md border border-slate-200 bg-white shadow-lg focus:outline-none">
                  <div className="py-1 text-sm text-slate-800">
                    <Menu.Item>
                      {({ active }) => (
                        <Link to="/services" className={`block px-3 py-2 ${active ? 'bg-slate-100' : ''}`}>
                          Сервисы
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link to="/technicians" className={`block px-3 py-2 ${active ? 'bg-slate-100' : ''}`}>
                          Техники
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link to="/bays" className={`block px-3 py-2 ${active ? 'bg-slate-100' : ''}`}>
                          Беи
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link to="/companies" className={`block px-3 py-2 ${active ? 'bg-slate-100' : ''}`}>
                          Компании
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link to="/vehicles" className={`block px-3 py-2 ${active ? 'bg-slate-100' : ''}`}>
                          Транспорт
                        </Link>
                      )}
                    </Menu.Item>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
            <NavLink to="/settings" className={navLinkClass} aria-label="Settings">
              Настройки
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={logout}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            aria-label="Log out"
          >
            Выйти
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
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
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/technicians" element={<TechniciansPage />} />
            <Route path="/bays" element={<BaysPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
