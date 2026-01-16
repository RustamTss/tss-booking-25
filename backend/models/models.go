package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserRole string

const (
	RoleAdmin  UserRole = "admin"
	RoleOffice UserRole = "office"
)

type BookingStatus string

const (
	BookingOpen       BookingStatus = "open"
	BookingInProgress BookingStatus = "in_progress"
	BookingClosed     BookingStatus = "closed"
	BookingCanceled   BookingStatus = "canceled"
	BookingGone       BookingStatus = "gone"
)

type RequestStatus string

const (
	RequestNew      RequestStatus = "new"
	RequestInReview RequestStatus = "in_review"
	RequestApproved RequestStatus = "approved"
	RequestRejected RequestStatus = "rejected"
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

// Contact belongs to a company and stores contact person details
type Contact struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CompanyID primitive.ObjectID `bson:"company_id" json:"company_id"`
	Name      string             `bson:"name" json:"name"`
	Phone     string             `bson:"phone" json:"phone"`
	Email     string             `bson:"email,omitempty" json:"email,omitempty"`
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
	Nickname  string             `bson:"nickname,omitempty" json:"nickname,omitempty"`
	Make      string             `bson:"make" json:"make"`
	Model     string             `bson:"model" json:"model"`
	Year      int                `bson:"year" json:"year"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
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

// ServiceWriter represents a front-desk service writer
type ServiceWriter struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string             `bson:"name" json:"name"`
	Phone     string             `bson:"phone" json:"phone"`
	Email     string             `bson:"email" json:"email"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type Bay struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Key       string             `bson:"key" json:"key"`
	Name      string             `bson:"name" json:"name"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

type Booking struct {
	ID               primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Number           string               `bson:"number" json:"number"`
	Title            string               `bson:"title,omitempty" json:"title,omitempty"`
	Complaint        string               `bson:"complaint,omitempty" json:"complaint,omitempty"`
	Description      string               `bson:"description" json:"description"`
	VehicleID        primitive.ObjectID   `bson:"vehicle_id" json:"vehicle_id"`
	FullbayServiceID string               `bson:"fullbay_service_id,omitempty" json:"fullbay_service_id,omitempty"`
	BayID            primitive.ObjectID   `bson:"bay_id" json:"bay_id"`
	TechnicianIDs    []primitive.ObjectID `bson:"technician_ids" json:"technician_ids"`
	CompanyID        primitive.ObjectID   `bson:"company_id" json:"company_id"`
	ServiceWriterID  primitive.ObjectID   `bson:"service_writer_id,omitempty" json:"service_writer_id,omitempty"`
	Start            time.Time            `bson:"start" json:"start"`
	End              *time.Time           `bson:"end,omitempty" json:"end,omitempty"`
	Status           BookingStatus        `bson:"status" json:"status"`
	Notes            string               `bson:"notes" json:"notes"`
	CreatedBy        primitive.ObjectID   `bson:"created_by" json:"created_by"`
	CreatedAt        time.Time            `bson:"created_at" json:"created_at"`
	UpdatedAt        time.Time            `bson:"updated_at" json:"updated_at"`
}

type Request struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	CompanyName string             `bson:"company_name" json:"company_name"`
	DriverName  string             `bson:"driver_name" json:"driver_name"`
	Phone       string             `bson:"phone" json:"phone"`
	UnitNumber  string             `bson:"unit_number" json:"unit_number"`
	StartAt     *time.Time         `bson:"start_at,omitempty" json:"start_at,omitempty"`
	Status      RequestStatus      `bson:"status" json:"status"`
	Source      string             `bson:"source,omitempty" json:"source,omitempty"`
	Username    string             `bson:"username,omitempty" json:"username,omitempty"`
	UserID      string             `bson:"user_id,omitempty" json:"user_id,omitempty"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}

type AuditLog struct {
	ID        primitive.ObjectID     `bson:"_id,omitempty" json:"id"`
	Action    string                 `bson:"action" json:"action"`
	Entity    string                 `bson:"entity" json:"entity"`
	EntityID  primitive.ObjectID     `bson:"entity_id" json:"entity_id"`
	UserID    primitive.ObjectID     `bson:"user_id" json:"user_id"`
	Meta      map[string]interface{} `bson:"meta" json:"meta"`
	CreatedAt time.Time              `bson:"created_at" json:"created_at"`
}

type Settings struct {
	ID               string    `bson:"_id,omitempty" json:"id"`
	TelegramToken    string    `bson:"telegram_token" json:"telegram_token"`
	TelegramChat     string    `bson:"telegram_chat" json:"telegram_chat"`
	TelegramTemplate string    `bson:"telegram_template" json:"telegram_template"`
	UpdatedAt        time.Time `bson:"updated_at" json:"updated_at"`
}

type RealtimeEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}
