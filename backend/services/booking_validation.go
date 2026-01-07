package services

import (
	"errors"
	"time"

	"github.com/tss-booking-system/backend/models"
)

var (
	ErrBayBusy = errors.New("bay is already booked in this timeframe")
)

func overlaps(newStart time.Time, newEnd *time.Time, otherStart time.Time, otherEnd *time.Time) bool {
	openEnded := time.Now().Add(365 * 24 * time.Hour)

	effectiveNewEnd := openEnded
	if newEnd != nil {
		effectiveNewEnd = *newEnd
	}

	effectiveOtherEnd := openEnded
	if otherEnd != nil {
		effectiveOtherEnd = *otherEnd
	}

	if !newStart.Before(effectiveOtherEnd) {
		return false
	}
	if !otherStart.Before(effectiveNewEnd) {
		return false
	}
	return true
}

// ValidateBookingConflict checks time overlaps for the same bay.
// Capacity is no longer used; any overlap is considered a conflict.
func ValidateBookingConflict(newBooking models.Booking, existing []models.Booking, _ int) error {
	conflicts := 0
	for _, b := range existing {
		if b.Status == models.BookingCanceled || b.Status == models.BookingClosed {
			continue
		}
		if b.BayID == newBooking.BayID && overlaps(newBooking.Start, newBooking.End, b.Start, b.End) {
			conflicts++
			if conflicts >= 1 {
				return ErrBayBusy
			}
		}
	}
	return nil
}
