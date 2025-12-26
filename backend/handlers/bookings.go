package handlers

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"github.com/tss-booking-system/backend/services"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const bookingCollection = "bookings"

type bookingRequest struct {
	Title         string               `json:"title"`
	Description   string               `json:"description"`
	VehicleID     string               `json:"vehicle_id"`
	ServiceIDs    []string             `json:"service_ids"`
	BayID         string               `json:"bay_id"`
	TechnicianIDs []string             `json:"technician_ids"`
	CompanyID     string               `json:"company_id"`
	Start         time.Time            `json:"start"`
	End           *time.Time           `json:"end"`
	Status        models.BookingStatus `json:"status"`
	Notes         string               `json:"notes"`
}

func parseObjectIDs(values []string) ([]primitive.ObjectID, error) {
	var ids []primitive.ObjectID
	for _, v := range values {
		id, err := asObjectID(v)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (h *Handler) ListBookings(c *fiber.Ctx) error {
	cur, err := h.DB.Collection(bookingCollection).Find(h.ctx(c), bson.D{})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Booking
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

func (h *Handler) CreateBooking(c *fiber.Ctx) error {
	var req bookingRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}

	vehicleID, err := asObjectID(req.VehicleID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid vehicle_id")
	}
	bayID, err := asObjectID(req.BayID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid bay_id")
	}
	bay, err := h.loadBay(c, bayID)
	if err != nil {
		return err
	}
	var companyID primitive.ObjectID
	if req.CompanyID != "" {
		companyID, err = asObjectID(req.CompanyID)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid company_id")
		}
	}
	serviceIDs, err := parseObjectIDs(req.ServiceIDs)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid service_ids")
	}
	technicianIDs, err := parseObjectIDs(req.TechnicianIDs)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid technician_ids")
	}

	status := req.Status
	if status == "" {
		status = models.BookingOpen
	}

	now := h.now()
	booking := models.Booking{
		ID:            primitive.NewObjectID(),
		Title:         req.Title,
		Description:   req.Description,
		VehicleID:     vehicleID,
		ServiceIDs:    serviceIDs,
		BayID:         bayID,
		TechnicianIDs: technicianIDs,
		CompanyID:     companyID,
		Start:         req.Start.In(h.TZ),
		End:           req.End,
		Status:        status,
		Notes:         req.Notes,
		CreatedBy:     primitive.NilObjectID,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if uid := getUserID(c); uid != "" {
		if userID, err := primitive.ObjectIDFromHex(uid); err == nil {
			booking.CreatedBy = userID
		}
	}

	existing, err := h.findConflictingBookings(c, booking.BayID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if err := services.ValidateBookingConflict(booking, existing, bay.Capacity); err != nil {
		return fiber.NewError(fiber.StatusConflict, err.Error())
	}

	if _, err := h.DB.Collection(bookingCollection).InsertOne(h.ctx(c), booking); err != nil {
		return fiber.ErrInternalServerError
	}

	pushRealtime(models.RealtimeEvent{Type: "booking.created", Data: booking})
	_ = h.Telegram.Notify(fmt.Sprintf("Новое бронирование: %s (бей %s) с %s", booking.Title, booking.BayID.Hex(), booking.Start.Format(time.RFC3339)))
	return c.Status(fiber.StatusCreated).JSON(booking)
}

func (h *Handler) UpdateBooking(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req bookingRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid body")
	}

	vehicleID, err := asObjectID(req.VehicleID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid vehicle_id")
	}
	bayID, err := asObjectID(req.BayID)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid bay_id")
	}
	bay, err := h.loadBay(c, bayID)
	if err != nil {
		return err
	}
	var companyID primitive.ObjectID
	if req.CompanyID != "" {
		companyID, err = asObjectID(req.CompanyID)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid company_id")
		}
	}
	serviceIDs, err := parseObjectIDs(req.ServiceIDs)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid service_ids")
	}
	technicianIDs, err := parseObjectIDs(req.TechnicianIDs)
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid technician_ids")
	}

	var existingBooking models.Booking
	if err := h.DB.Collection(bookingCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&existingBooking); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
	}

	updatedBooking := existingBooking
	updatedBooking.Title = req.Title
	updatedBooking.Description = req.Description
	updatedBooking.VehicleID = vehicleID
	updatedBooking.ServiceIDs = serviceIDs
	updatedBooking.BayID = bayID
	updatedBooking.TechnicianIDs = technicianIDs
	updatedBooking.CompanyID = companyID
	updatedBooking.Start = req.Start.In(h.TZ)
	updatedBooking.End = req.End
	if req.Status != "" {
		updatedBooking.Status = req.Status
	}
	updatedBooking.Notes = req.Notes
	updatedBooking.UpdatedAt = h.now()

	conflicts, err := h.findConflictingBookings(c, updatedBooking.BayID)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	filtered := make([]models.Booking, 0, len(conflicts))
	for _, b := range conflicts {
		if b.ID != id {
			filtered = append(filtered, b)
		}
	}
	if err := services.ValidateBookingConflict(updatedBooking, filtered, bay.Capacity); err != nil {
		return fiber.NewError(fiber.StatusConflict, err.Error())
	}

	update := bson.M{
		"$set": bson.M{
			"title":          updatedBooking.Title,
			"description":    updatedBooking.Description,
			"vehicle_id":     updatedBooking.VehicleID,
			"service_ids":    updatedBooking.ServiceIDs,
			"bay_id":         updatedBooking.BayID,
			"technician_ids": updatedBooking.TechnicianIDs,
			"company_id":     updatedBooking.CompanyID,
			"start":          updatedBooking.Start,
			"end":            updatedBooking.End,
			"status":         updatedBooking.Status,
			"notes":          updatedBooking.Notes,
			"updated_at":     updatedBooking.UpdatedAt,
		},
	}
	if _, err := h.DB.Collection(bookingCollection).UpdateByID(h.ctx(c), id, update); err != nil {
		return fiber.ErrInternalServerError
	}

	pushRealtime(models.RealtimeEvent{Type: "booking.updated", Data: updatedBooking})
	return c.JSON(updatedBooking)
}

func (h *Handler) CancelBooking(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	now := h.now()
	update := bson.M{"$set": bson.M{"status": models.BookingCanceled, "end": &now, "updated_at": now}}
	res, err := h.DB.Collection(bookingCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	pushRealtime(models.RealtimeEvent{Type: "booking.canceled", Data: id.Hex()})
	_ = h.Telegram.Notify(fmt.Sprintf("Бронирование отменено: %s", id.Hex()))
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) CloseBooking(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	now := h.now()
	update := bson.M{"$set": bson.M{"status": models.BookingClosed, "end": &now, "updated_at": now}}
	res, err := h.DB.Collection(bookingCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	pushRealtime(models.RealtimeEvent{Type: "booking.closed", Data: id.Hex()})
	_ = h.Telegram.Notify(fmt.Sprintf("Бронирование закрыто: %s", id.Hex()))
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) findConflictingBookings(c *fiber.Ctx, bayID primitive.ObjectID) ([]models.Booking, error) {
	filter := bson.M{
		"status": bson.M{"$in": []models.BookingStatus{models.BookingOpen, models.BookingInProgress}},
		"bay_id": bayID,
	}
	cur, err := h.DB.Collection(bookingCollection).Find(h.ctx(c), filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(h.ctx(c))

	var items []models.Booking
	if err := cur.All(h.ctx(c), &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (h *Handler) DashboardSummary(c *fiber.Ctx) error {
	now := h.now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, h.TZ)
	endOfDay := startOfDay.Add(24 * time.Hour)

	openFilter := bson.M{"status": bson.M{"$in": []models.BookingStatus{models.BookingOpen, models.BookingInProgress}}}
	openCount, _ := h.DB.Collection(bookingCollection).CountDocuments(h.ctx(c), openFilter)

	todayFilter := bson.M{
		"start": bson.M{"$gte": startOfDay, "$lt": endOfDay},
	}
	todayCount, _ := h.DB.Collection(bookingCollection).CountDocuments(h.ctx(c), todayFilter)

	baysCount, _ := h.DB.Collection(bayCollection).CountDocuments(h.ctx(c), bson.D{})

	return c.JSON(fiber.Map{
		"open_bookings":  openCount,
		"today_bookings": todayCount,
		"bays":           baysCount,
		"timestamp":      now,
	})
}

// Agenda возвращает события в диапазоне дат.
func (h *Handler) Agenda(c *fiber.Ctx) error {
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		return fiber.ErrBadRequest
	}
	fromTime, err := time.Parse(time.RFC3339, from)
	if err != nil {
		return fiber.ErrBadRequest
	}
	toTime, err := time.Parse(time.RFC3339, to)
	if err != nil {
		return fiber.ErrBadRequest
	}

	filter := bson.M{
		"start": bson.M{"$lt": toTime},
		"$or": []bson.M{
			{"end": bson.M{"$gt": fromTime}},
			{"end": bson.M{"$exists": false}},
		},
	}
	cur, err := h.DB.Collection(bookingCollection).Find(h.ctx(c), filter)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Booking
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

func formatServices(ids []primitive.ObjectID) string {
	var parts []string
	for _, id := range ids {
		parts = append(parts, id.Hex())
	}
	return strings.Join(parts, ",")
}

func (h *Handler) loadBay(c *fiber.Ctx, bayID primitive.ObjectID) (models.Bay, error) {
	var bay models.Bay
	err := h.DB.Collection(bayCollection).FindOne(h.ctx(c), bson.M{"_id": bayID}).Decode(&bay)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return bay, fiber.NewError(fiber.StatusBadRequest, "bay not found")
		}
		return bay, fiber.ErrInternalServerError
	}
	if bay.Capacity <= 0 {
		bay.Capacity = 3
	}
	return bay, nil
}
