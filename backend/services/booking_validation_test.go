package services

import (
	"testing"
	"time"

	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestValidateBookingConflictBay(t *testing.T) {
	now := time.Now()
	later := now.Add(2 * time.Hour)
	existing := models.Booking{
		BayID:  primitive.NewObjectID(),
		Start:  now,
		End:    &later,
		Status: models.BookingOpen,
	}

	end := later.Add(30 * time.Minute)
	newBooking := models.Booking{
		BayID:  existing.BayID,
		Start:  now.Add(30 * time.Minute),
		End:    &end,
		Status: models.BookingOpen,
	}

	err := ValidateBookingConflict(newBooking, []models.Booking{existing}, 1)
	if err != ErrBayBusy {
		t.Fatalf("expected bay conflict, got %v", err)
	}
}

func TestValidateBookingConflictCapacity(t *testing.T) {
	now := time.Now()
	bayID := primitive.NewObjectID()
	existing := []models.Booking{
		{BayID: bayID, Start: now, End: nil, Status: models.BookingOpen},
		{BayID: bayID, Start: now.Add(5 * time.Minute), End: nil, Status: models.BookingOpen},
	}
	newBooking := models.Booking{BayID: bayID, Start: now.Add(10 * time.Minute), End: nil, Status: models.BookingOpen}

	if err := ValidateBookingConflict(newBooking, existing, 3); err != nil {
		t.Fatalf("expected allowed because capacity=3, got %v", err)
	}

	existing = append(existing, models.Booking{BayID: bayID, Start: now.Add(2 * time.Minute), End: nil, Status: models.BookingOpen})
	if err := ValidateBookingConflict(newBooking, existing, 3); err != ErrBayBusy {
		t.Fatalf("expected conflict at capacity=3, got %v", err)
	}
}
