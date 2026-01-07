export type UserRole = 'admin' | 'office'

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
	key: string
	name: string
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

export interface Contact {
	id: string
	company_id: string
	name: string
	phone: string
	email?: string
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
	title?: string
	complaint?: string
	number?: string
	description: string
	vehicle_id: string
	fullbay_service_id?: string
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
	top?: {
		technicians: Array<{ id: string; name: string; count: number }>
		units: Array<{ id: string; name: string; count: number }>
		companies: Array<{ id: string; name: string; count: number }>
		bays: Array<{ id: string; name: string; count: number }>
	}
}

export interface AuditLog {
	id: string
	action: string
	entity: string
	entity_id: string
	user_id?: string
	meta?: Record<string, unknown>
	created_at: string
}

export interface TelegramSettings {
	telegram_token: string
	telegram_chat: string
	telegram_template?: string
}

export interface User {
	id: string
	email: string
	role: UserRole
	status: string
	created_at: string
	updated_at: string
}
