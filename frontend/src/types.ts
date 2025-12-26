export type UserRole = 'admin' | 'dispatcher' | 'mechanic' | 'client'

export interface Service {
  id: string
  name: string
  description: string
  duration_minutes: number
  price_cents: number
  created_at: string
  updated_at: string
}
export interface ServiceForm {
  name: string
  description: string
  duration_minutes: number
  price: string
}

export interface Technician {
  id: string
  name: string
  skills: string[]
  phone: string
  email: string
  created_at: string
  updated_at: string
}

export interface Bay {
  id: string
  name: string
  capacity: number
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  contact: string
  phone: string
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  company_id: string
  type: 'truck' | 'trailer'
  vin: string
  plate: string
  make: string
  model: string
  year: number
  created_at: string
  updated_at: string
}

export type BookingStatus = 'open' | 'in_progress' | 'closed' | 'canceled'

export interface Booking {
  id: string
  title: string
  description: string
  vehicle_id: string
  service_ids: string[]
  bay_id: string
  technician_ids: string[]
  company_id: string
  start: string
  end?: string
  status: BookingStatus
  notes: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface DashboardSummary {
  open_bookings: number
  today_bookings: number
  bays: number
  timestamp: string
}

export interface TelegramSettings {
  telegram_token: string
  telegram_chat: string
}

export interface User {
  id: string
  email: string
  role: UserRole
  status: string
  created_at: string
  updated_at: string
}

