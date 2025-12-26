package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserRole string

const (
	RoleAdmin      UserRole = "admin"
	RoleDispatcher UserRole = "dispatcher"
	RoleMechanic   UserRole = "mechanic"
	RoleClient     UserRole = "client"
)

type BookingStatus string

const (
	BookingOpen       BookingStatus = "open"
	BookingInProgress BookingStatus = "in_progress"
	BookingClosed     BookingStatus = "closed"
	BookingCanceled   BookingStatus = "canceled"
)

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string             `bson:"email" json:"email"`
	PasswordHash string             `bson:"password_hash" json:"-"`
	Role         UserRole           `bson:"role" json:"role"`
	Status       string             `bson:"status" json:"status"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

type Company struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Contact   string             `bson:"contact" json:"contact"`
	Phone     string             `bson:"phone" json:"phone"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type VehicleType string

const (
	VehicleTruck   VehicleType = "truck"
	VehicleTrailer VehicleType = "trailer"
)

type Vehicle struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CompanyID primitive.ObjectID `bson:"company_id" json:"company_id"`
	Type      VehicleType        `bson:"type" json:"type"`
	VIN       string             `bson:"vin" json:"vin"`
	Plate     string             `bson:"plate" json:"plate"`
	Make      string             `bson:"make" json:"make"`
	Model     string             `bson:"model" json:"model"`
	Year      int                `bson:"year" json:"year"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type Service struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name            string             `bson:"name" json:"name"`
	Description     string             `bson:"description" json:"description"`
	DurationMinutes int                `bson:"duration_minutes" json:"duration_minutes"`
	PriceCents      int64              `bson:"price_cents" json:"price_cents"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updated_at"`
}

type Technician struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Skills    []string           `bson:"skills" json:"skills"`
	Phone     string             `bson:"phone" json:"phone"`
	Email     string             `bson:"email" json:"email"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type Bay struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Capacity  int                `bson:"capacity" json:"capacity"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type Booking struct {
	ID            primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Title         string               `bson:"title" json:"title"`
	Description   string               `bson:"description" json:"description"`
	VehicleID     primitive.ObjectID   `bson:"vehicle_id" json:"vehicle_id"`
	ServiceIDs    []primitive.ObjectID `bson:"service_ids" json:"service_ids"`
	BayID         primitive.ObjectID   `bson:"bay_id" json:"bay_id"`
	TechnicianIDs []primitive.ObjectID `bson:"technician_ids" json:"technician_ids"`
	CompanyID     primitive.ObjectID   `bson:"company_id" json:"company_id"`
	Start         time.Time            `bson:"start" json:"start"`
	End           *time.Time           `bson:"end,omitempty" json:"end,omitempty"`
	Status        BookingStatus        `bson:"status" json:"status"`
	Notes         string               `bson:"notes" json:"notes"`
	CreatedBy     primitive.ObjectID   `bson:"created_by" json:"created_by"`
	CreatedAt     time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time            `bson:"updated_at" json:"updated_at"`
}

type AuditLog struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Action    string             `bson:"action" json:"action"`
	Entity    string             `bson:"entity" json:"entity"`
	EntityID  primitive.ObjectID `bson:"entity_id" json:"entity_id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	Meta      interface{}        `bson:"meta" json:"meta"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type Settings struct {
	ID            string    `bson:"_id,omitempty" json:"id"`
	TelegramToken string    `bson:"telegram_token" json:"telegram_token"`
	TelegramChat  string    `bson:"telegram_chat" json:"telegram_chat"`
	UpdatedAt     time.Time `bson:"updated_at" json:"updated_at"`
}

type RealtimeEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}
