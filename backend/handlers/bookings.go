package handlers

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"github.com/tss-booking-system/backend/services"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const bookingCollection = "bookings"

type bookingRequest struct {
	Complaint        string               `json:"complaint"`
	Description      string               `json:"description"`
	VehicleID        string               `json:"vehicle_id"`
	FullbayServiceID string               `json:"fullbay_service_id"`
	BayID            string               `json:"bay_id"`
	TechnicianIDs    []string             `json:"technician_ids"`
	CompanyID        string               `json:"company_id"`
	Start            time.Time            `json:"start"`
	End              *time.Time           `json:"end"`
	Status           models.BookingStatus `json:"status"`
	Notes            string               `json:"notes"`
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
	// Build filters from query params
	filter := bson.M{}
	if v := c.Query("company_id"); v != "" {
		if id, err := asObjectID(v); err == nil {
			filter["company_id"] = id
		} else {
			return fiber.NewError(fiber.StatusBadRequest, "invalid company_id")
		}
	}
	if v := c.Query("vehicle_id"); v != "" {
		if id, err := asObjectID(v); err == nil {
			filter["vehicle_id"] = id
		} else {
			return fiber.NewError(fiber.StatusBadRequest, "invalid vehicle_id")
		}
	}
	if v := c.Query("bay_id"); v != "" {
		if id, err := asObjectID(v); err == nil {
			filter["bay_id"] = id
		} else {
			return fiber.NewError(fiber.StatusBadRequest, "invalid bay_id")
		}
	}
	if v := c.Query("status"); v != "" {
		filter["status"] = models.BookingStatus(v)
	}
	if v := c.Query("technician_id"); v != "" {
		if id, err := asObjectID(v); err == nil {
			filter["technician_ids"] = bson.M{"$in": []primitive.ObjectID{id}}
		} else {
			return fiber.NewError(fiber.StatusBadRequest, "invalid technician_id")
		}
	}
	cur, err := h.DB.Collection(bookingCollection).Find(
		h.ctx(c),
		filter,
		options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}),
	)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Booking
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	// CSV export if requested
	if exp := strings.ToLower(c.Query("export")); exp == "csv" || exp == "excel" {
		// Resolve referenced labels (unit plate/vin, bay/company names, technician names)
		vehicleIDs := make([]primitive.ObjectID, 0)
		bayIDs := make([]primitive.ObjectID, 0)
		companyIDs := make([]primitive.ObjectID, 0)
		techIDSet := map[primitive.ObjectID]struct{}{}
		for _, b := range items {
			vehicleIDs = append(vehicleIDs, b.VehicleID)
			bayIDs = append(bayIDs, b.BayID)
			if b.CompanyID != primitive.NilObjectID {
				companyIDs = append(companyIDs, b.CompanyID)
			}
			for _, t := range b.TechnicianIDs {
				techIDSet[t] = struct{}{}
			}
		}
		techIDs := make([]primitive.ObjectID, 0, len(techIDSet))
		for id := range techIDSet {
			techIDs = append(techIDs, id)
		}
		vehicleLabels := map[primitive.ObjectID]string{}
		if len(vehicleIDs) > 0 {
			cur, _ := h.DB.Collection(vehicleCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": vehicleIDs}})
			defer cur.Close(h.ctx(c))
			for cur.Next(h.ctx(c)) {
				var v models.Vehicle
				if err := cur.Decode(&v); err == nil {
					label := v.Plate
					if label == "" {
						label = v.VIN
					}
					vehicleLabels[v.ID] = label
				}
			}
		}
		bayNames := map[primitive.ObjectID]string{}
		if len(bayIDs) > 0 {
			cur, _ := h.DB.Collection(bayCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": bayIDs}})
			defer cur.Close(h.ctx(c))
			for cur.Next(h.ctx(c)) {
				var b models.Bay
				if err := cur.Decode(&b); err == nil {
					bayNames[b.ID] = b.Name
				}
			}
		}
		companyNames := map[primitive.ObjectID]string{}
		if len(companyIDs) > 0 {
			cur, _ := h.DB.Collection(companyCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": companyIDs}})
			defer cur.Close(h.ctx(c))
			for cur.Next(h.ctx(c)) {
				var comp models.Company
				if err := cur.Decode(&comp); err == nil {
					companyNames[comp.ID] = comp.Name
				}
			}
		}
		techNames := map[primitive.ObjectID]string{}
		if len(techIDs) > 0 {
			cur, _ := h.DB.Collection(technicianCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": techIDs}})
			defer cur.Close(h.ctx(c))
			for cur.Next(h.ctx(c)) {
				var t models.Technician
				if err := cur.Decode(&t); err == nil {
					techNames[t.ID] = t.Name
				}
			}
		}
		var buf bytes.Buffer
		w := csv.NewWriter(&buf)
		_ = w.Write([]string{
			"number", "complaint", "description", "unit", "bay", "company", "technicians",
			"start", "end", "status",
		})
		const pretty = "01/02/2006, 03:04 PM"
		for _, b := range items {
			end := ""
			if b.End != nil {
				end = b.End.In(h.TZ).Format(pretty)
			}
			unit := vehicleLabels[b.VehicleID]
			if unit == "" {
				unit = b.VehicleID.Hex()
			}
			bay := bayNames[b.BayID]
			if bay == "" {
				bay = b.BayID.Hex()
			}
			company := ""
			if b.CompanyID != primitive.NilObjectID {
				company = companyNames[b.CompanyID]
				if company == "" {
					company = b.CompanyID.Hex()
				}
			}
			var techs []string
			for _, t := range b.TechnicianIDs {
				if name := techNames[t]; name != "" {
					techs = append(techs, name)
				}
			}
			_ = w.Write([]string{
				b.Number,
				b.Complaint,
				b.Description,
				unit,
				bay,
				company,
				strings.Join(techs, ", "),
				b.Start.In(h.TZ).Format(pretty),
				end,
				string(b.Status),
			})
		}
		w.Flush()
		c.Set("Content-Type", "text/csv")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"bookings-%d.csv\"", time.Now().Unix()))
		return c.Send(buf.Bytes())
	}
	return c.JSON(items)
}

func (h *Handler) GetBooking(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var b models.Booking
	if err := h.DB.Collection(bookingCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&b); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
	}
	return c.JSON(b)
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
	// capacity removed; no need to load bay here
	var companyID primitive.ObjectID
	if req.CompanyID != "" {
		companyID, err = asObjectID(req.CompanyID)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid company_id")
		}
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
		ID:               primitive.NewObjectID(),
		Number:           "",
		Title:            "",
		Complaint:        req.Complaint,
		Description:      req.Description,
		VehicleID:        vehicleID,
		FullbayServiceID: req.FullbayServiceID,
		BayID:            bayID,
		TechnicianIDs:    technicianIDs,
		CompanyID:        companyID,
		Start:            req.Start.In(h.TZ),
		End:              req.End,
		Status:           status,
		Notes:            req.Notes,
		CreatedBy:        primitive.NilObjectID,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	// Generate sequential booking number 000001, 000002, ...
	{
		var seqDoc struct {
			Seq int64 `bson:"seq"`
		}
		err := h.DB.Collection("counters").
			FindOneAndUpdate(
				h.ctx(c),
				bson.M{"_id": "booking_number"},
				bson.M{"$inc": bson.M{"seq": 1}},
				options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After),
			).Decode(&seqDoc)
		if err == nil && seqDoc.Seq > 0 {
			booking.Number = fmt.Sprintf("%06d", seqDoc.Seq)
		} else {
			// fallback to timestamp if counter fails
			booking.Number = fmt.Sprintf("%06d", time.Now().Unix()%1000000)
		}
	}
	if uid := getUserID(c); uid != "" {
		if userID, err := primitive.ObjectIDFromHex(uid); err == nil {
			booking.CreatedBy = userID
		}
	}

	// Skip conflict validation for the special "WaitingList" bay
	if wlID, ok := h.findWaitingListBayID(c); !ok || wlID != booking.BayID {
		existing, err := h.findConflictingBookings(c, booking.BayID)
		if err != nil {
			return fiber.ErrInternalServerError
		}
		if err := services.ValidateBookingConflict(booking, existing, 1); err != nil {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
	}

	if _, err := h.DB.Collection(bookingCollection).InsertOne(h.ctx(c), booking); err != nil {
		return fiber.ErrInternalServerError
	}
	// audit: booking.created
	{
		var actor primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id, err := primitive.ObjectIDFromHex(uid); err == nil {
				actor = id
			}
		}
		meta := bson.M{
			"number":     booking.Number,
			"vehicle_id": booking.VehicleID.Hex(),
			"bay_id":     booking.BayID.Hex(),
			"company_id": booking.CompanyID.Hex(),
			"start":      booking.Start,
			"end":        booking.End,
			"status":     booking.Status,
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
			ID:        primitive.NewObjectID(),
			Action:    "booking.created",
			Entity:    "booking",
			EntityID:  booking.ID,
			UserID:    actor,
			Meta:      meta,
			CreatedAt: h.now(),
		})
	}
	// audit: technician booking assignment on create
	if len(booking.TechnicianIDs) > 0 {
		var userID primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id, err := primitive.ObjectIDFromHex(uid); err == nil {
				userID = id
			}
		}
		for _, techID := range booking.TechnicianIDs {
			_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
				ID:        primitive.NewObjectID(),
				Action:    "booking.assigned",
				Entity:    "technician",
				EntityID:  techID,
				UserID:    userID,
				Meta:      bson.M{"booking_id": booking.ID, "number": booking.Number},
				CreatedAt: h.now(),
			})
		}
	}

	pushRealtime(models.RealtimeEvent{Type: "booking.created", Data: booking})
	// Try templated notification
	var settings models.Settings
	_ = h.DB.Collection(settingsCollection).FindOne(h.ctx(c), bson.M{"_id": "global"}).Decode(&settings)
	if settings.TelegramTemplate != "" {
		data := h.buildTelegramData(c, booking)
		// status placeholders for template
		data["status_icon"] = "🆕"
		data["status_name"] = "New booking"
		msg := services.Render(settings.TelegramTemplate, data)
		if strings.TrimSpace(msg) == "" {
			// Fallback rich message
			msg = h.renderTelegramFallback("created", booking, data)
		}
		_ = h.Telegram.Notify(msg)
	} else {
		data := h.buildTelegramData(c, booking)
		_ = h.Telegram.Notify(h.renderTelegramFallback("created", booking, data))
	}
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
	// capacity removed; no need to load bay here
	var companyID primitive.ObjectID
	if req.CompanyID != "" {
		companyID, err = asObjectID(req.CompanyID)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid company_id")
		}
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
	updatedBooking.Title = ""
	updatedBooking.Complaint = req.Complaint
	updatedBooking.Description = req.Description
	updatedBooking.VehicleID = vehicleID
	updatedBooking.FullbayServiceID = req.FullbayServiceID
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

	// Skip conflict validation if updating to the special "WaitingList" bay
	if wlID, ok := h.findWaitingListBayID(c); !ok || wlID != updatedBooking.BayID {
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
		if err := services.ValidateBookingConflict(updatedBooking, filtered, 1); err != nil {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
	}

	update := bson.M{
		"$set": bson.M{
			"title":              updatedBooking.Title,
			"complaint":          updatedBooking.Complaint,
			"description":        updatedBooking.Description,
			"vehicle_id":         updatedBooking.VehicleID,
			"fullbay_service_id": updatedBooking.FullbayServiceID,
			"bay_id":             updatedBooking.BayID,
			"technician_ids":     updatedBooking.TechnicianIDs,
			"company_id":         updatedBooking.CompanyID,
			"start":              updatedBooking.Start,
			"end":                updatedBooking.End,
			"status":             updatedBooking.Status,
			"notes":              updatedBooking.Notes,
			"updated_at":         updatedBooking.UpdatedAt,
		},
	}
	if _, err := h.DB.Collection(bookingCollection).UpdateByID(h.ctx(c), id, update); err != nil {
		return fiber.ErrInternalServerError
	}
	// audit: capture changes and new technician assignments on update
	{
		oldSet := map[primitive.ObjectID]bool{}
		for _, t := range existingBooking.TechnicianIDs {
			oldSet[t] = true
		}
		var userID primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if u, err := primitive.ObjectIDFromHex(uid); err == nil {
				userID = u
			}
		}
		// general diffs
		changes := bson.M{}
		if existingBooking.VehicleID != updatedBooking.VehicleID {
			changes["vehicle_id"] = bson.M{"from": existingBooking.VehicleID.Hex(), "to": updatedBooking.VehicleID.Hex()}
		}
		if existingBooking.BayID != updatedBooking.BayID {
			changes["bay_id"] = bson.M{"from": existingBooking.BayID.Hex(), "to": updatedBooking.BayID.Hex()}
		}
		if existingBooking.CompanyID != updatedBooking.CompanyID {
			changes["company_id"] = bson.M{"from": existingBooking.CompanyID.Hex(), "to": updatedBooking.CompanyID.Hex()}
		}
		if !existingBooking.Start.Equal(updatedBooking.Start) {
			changes["start"] = bson.M{"from": existingBooking.Start, "to": updatedBooking.Start}
		}
		if (existingBooking.End == nil) != (updatedBooking.End == nil) ||
			(existingBooking.End != nil && updatedBooking.End != nil && !existingBooking.End.Equal(*updatedBooking.End)) {
			changes["end"] = bson.M{"from": existingBooking.End, "to": updatedBooking.End}
		}
		if existingBooking.Status != updatedBooking.Status {
			changes["status"] = bson.M{"from": existingBooking.Status, "to": updatedBooking.Status}
		}
		if existingBooking.Complaint != updatedBooking.Complaint {
			changes["complaint"] = bson.M{"from": existingBooking.Complaint, "to": updatedBooking.Complaint}
		}
		if existingBooking.Description != updatedBooking.Description {
			changes["description"] = bson.M{"from": existingBooking.Description, "to": updatedBooking.Description}
		}
		// technicians diff
		newSet := map[primitive.ObjectID]bool{}
		for _, t := range updatedBooking.TechnicianIDs {
			newSet[t] = true
		}
		var added, removed []string
		for _, t := range updatedBooking.TechnicianIDs {
			if !oldSet[t] {
				added = append(added, t.Hex())
			}
		}
		for t := range oldSet {
			if !newSet[t] {
				removed = append(removed, t.Hex())
			}
		}
		if len(added) > 0 {
			changes["technicians_added"] = added
		}
		if len(removed) > 0 {
			changes["technicians_removed"] = removed
		}
		if len(changes) > 0 {
			_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
				ID:        primitive.NewObjectID(),
				Action:    "booking.updated",
				Entity:    "booking",
				EntityID:  id,
				UserID:    userID,
				Meta:      changes,
				CreatedAt: h.now(),
			})
		}
	}

	pushRealtime(models.RealtimeEvent{Type: "booking.updated", Data: updatedBooking})
	// Notify via template if present
	{
		var settings models.Settings
		_ = h.DB.Collection(settingsCollection).FindOne(h.ctx(c), bson.M{"_id": "global"}).Decode(&settings)
		if settings.TelegramTemplate != "" {
			data := h.buildTelegramData(c, updatedBooking)
			// Distinguish reschedule vs other updates for template placeholders
			timeChanged := !existingBooking.Start.Equal(updatedBooking.Start) ||
				((existingBooking.End == nil) != (updatedBooking.End == nil)) ||
				(existingBooking.End != nil && updatedBooking.End != nil && !existingBooking.End.Equal(*updatedBooking.End))
			if timeChanged {
				data["status_icon"] = "📅"
				data["status_name"] = "Booking rescheduled"
			} else {
				data["status_icon"] = "✏️"
				data["status_name"] = "Booking updated"
			}
			msg := services.Render(settings.TelegramTemplate, data)
			_ = h.Telegram.Notify(msg)
		}
	}
	return c.JSON(updatedBooking)
}

func (h *Handler) CancelBooking(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	// load booking for telegram details
	var b models.Booking
	if err := h.DB.Collection(bookingCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&b); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
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
	b.Status = models.BookingCanceled
	b.End = &now
	data := h.buildTelegramData(c, b)
	_ = h.Telegram.Notify(h.renderTelegramFallback("canceled", b, data))
	// audit
	{
		var actor primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id2, err := primitive.ObjectIDFromHex(uid); err == nil {
				actor = id2
			}
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
			ID:        primitive.NewObjectID(),
			Action:    "booking.canceled",
			Entity:    "booking",
			EntityID:  id,
			UserID:    actor,
			Meta:      bson.M{},
			CreatedAt: h.now(),
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) CloseBooking(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	// load booking for telegram details
	var b models.Booking
	if err := h.DB.Collection(bookingCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&b); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
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
	b.Status = models.BookingClosed
	b.End = &now
	data := h.buildTelegramData(c, b)
	_ = h.Telegram.Notify(h.renderTelegramFallback("closed", b, data))
	// audit
	{
		var actor primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id2, err := primitive.ObjectIDFromHex(uid); err == nil {
				actor = id2
			}
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
			ID:        primitive.NewObjectID(),
			Action:    "booking.closed",
			Entity:    "booking",
			EntityID:  id,
			UserID:    actor,
			Meta:      bson.M{},
			CreatedAt: h.now(),
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) DeleteBooking(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(bookingCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	pushRealtime(models.RealtimeEvent{Type: "booking.deleted", Data: id.Hex()})
	return c.SendStatus(fiber.StatusNoContent)
}

// ListBookingLogs returns audit logs for a booking
func (h *Handler) ListBookingLogs(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), bson.M{
		"entity":    "booking",
		"entity_id": id,
	}, opts)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))
	var logs []models.AuditLog
	if err := cur.All(h.ctx(c), &logs); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(logs)
}

// buildTelegramData collects placeholder values for template rendering.
func (h *Handler) buildTelegramData(c *fiber.Ctx, b models.Booking) map[string]string {
	data := map[string]string{
		// booking_id maps to the public number for template convenience
		"booking_id": func() string {
			if b.Number != "" {
				return b.Number
			}
			return b.ID.Hex()
		}(),
		"number":      b.Number,
		"title":       b.Title,
		"complaint":   b.Complaint,
		"description": b.Description,
		"status":      string(b.Status),
		// default placeholders formatted for human reading (match UI DateTime picker)
		"start": "",
		"end":   "",
	}
	// Provide both human-friendly and ISO formats
	const pretty = "01/02/2006, 03:04 PM"
	data["start"] = b.Start.In(h.TZ).Format(pretty)
	data["start_pretty"] = data["start"]
	data["start_iso"] = b.Start.In(h.TZ).Format(time.RFC3339)
	if b.End != nil {
		data["end"] = b.End.In(h.TZ).Format(pretty)
		data["end_pretty"] = data["end"]
		data["end_iso"] = b.End.In(h.TZ).Format(time.RFC3339)
	} else {
		data["end_iso"] = ""
	}
	// Vehicle / unit
	var vehicle models.Vehicle
	if err := h.DB.Collection(vehicleCollection).FindOne(h.ctx(c), bson.M{"_id": b.VehicleID}).Decode(&vehicle); err == nil {
		data["vehicle_plate"] = vehicle.Plate
		data["vehicle_vin"] = vehicle.VIN
		data["vehicle_make"] = vehicle.Make
		data["vehicle_model"] = vehicle.Model
		data["unit_plate"] = vehicle.Plate
		data["unit_vin"] = vehicle.VIN
		data["unit_make"] = vehicle.Make
		data["unit_model"] = vehicle.Model
		unit := vehicle.Plate
		if unit == "" {
			unit = vehicle.VIN
		}
		data["unit"] = unit
	}
	// Bay
	var bay models.Bay
	if err := h.DB.Collection(bayCollection).FindOne(h.ctx(c), bson.M{"_id": b.BayID}).Decode(&bay); err == nil {
		data["bay_name"] = bay.Name
	}
	// Company
	var company models.Company
	if err := h.DB.Collection(companyCollection).FindOne(h.ctx(c), bson.M{"_id": b.CompanyID}).Decode(&company); err == nil {
		data["company_name"] = company.Name
	}
	// Fullbay service id
	if b.FullbayServiceID != "" {
		data["fullbay_service_id"] = b.FullbayServiceID
	}
	// Technicians
	if len(b.TechnicianIDs) > 0 {
		cur, _ := h.DB.Collection(technicianCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": b.TechnicianIDs}})
		defer cur.Close(h.ctx(c))
		var names []string
		for cur.Next(h.ctx(c)) {
			var t models.Technician
			if err := cur.Decode(&t); err == nil {
				names = append(names, t.Name)
			}
		}
		data["technician_names"] = strings.Join(names, ", ")
	}
	return data
}

func (h *Handler) renderTelegramFallback(kind string, b models.Booking, data map[string]string) string {
	// Resolve status icon/title
	icon := "ℹ️"
	title := "Booking"
	switch kind {
	case "created":
		icon = "🆕"
		title = "New booking"
	case "updated":
		icon = "✏️"
		title = "Booking updated"
	case "canceled":
		icon = "🚫"
		title = "Booking canceled"
	case "closed":
		icon = "✅"
		title = "Booking ready"
	}
	// Dates formatted like UI
	const pretty = "01/02/2006, 03:04 PM"
	start := b.Start.In(h.TZ).Format(pretty)
	end := ""
	if b.End != nil {
		end = b.End.In(h.TZ).Format(pretty)
	}
	// Resolve unit label
	unit := data["unit"]
	if unit == "" {
		unit = data["vehicle_plate"]
		if unit == "" {
			unit = data["vehicle_vin"]
		}
	}
	company := data["company_name"]
	bay := data["bay_name"]
	service := data["fullbay_service_id"]
	techs := data["technician_names"]
	number := b.Number
	if number == "" {
		number = b.ID.Hex()
	}
	// Build rich, consistent message
	var sb strings.Builder
	fmt.Fprintf(&sb, "%s <b>%s</b> • <b>#%s</b>\n\n", icon, title, number)
	if c := data["complaint"]; c != "" {
		fmt.Fprintf(&sb, "<b>Complaint:</b> %s\n", c)
	}
	if d := data["description"]; d != "" {
		fmt.Fprintf(&sb, "<b>Description:</b> %s\n\n", d)
	} else {
		sb.WriteString("\n")
	}
	if unit != "" || (data["unit_plate"] != "" || data["unit_vin"] != "") {
		fmt.Fprintf(&sb, "<b>Unit:</b> %s", unit)
		plate, vin := data["unit_plate"], data["unit_vin"]
		if plate != "" || vin != "" {
			fmt.Fprintf(&sb, "  (%s %s)", plate, vin)
		}
		sb.WriteString("\n")
	}
	if bay != "" {
		fmt.Fprintf(&sb, "<b>Bay:</b> %s\n", bay)
	}
	if company != "" {
		fmt.Fprintf(&sb, "<b>Company:</b> %s\n", company)
	}
	if service != "" {
		fmt.Fprintf(&sb, "<b>Fullbay Service ID:</b> %s\n\n", service)
	} else {
		sb.WriteString("\n")
	}
	if techs != "" {
		fmt.Fprintf(&sb, "<b>Technicians:</b> %s\n\n", techs)
	} else {
		sb.WriteString("\n")
	}
	fmt.Fprintf(&sb, "<b>Start:</b> %s\n", start)
	if end != "" {
		fmt.Fprintf(&sb, "<b>End:</b> %s\n", end)
	}
	return sb.String()
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

	// Top aggregates (all-time)
	type kv struct {
		ID    primitive.ObjectID `bson:"_id"`
		Count int                `bson:"count"`
	}
	// Top technicians
	var topTechAgg []kv
	if cur, err := h.DB.Collection(bookingCollection).Aggregate(h.ctx(c), mongo.Pipeline{
		{{Key: "$unwind", Value: "$technician_ids"}},
		{{Key: "$group", Value: bson.M{"_id": "$technician_ids", "count": bson.M{"$sum": 1}}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
		{{Key: "$limit", Value: 5}},
	}); err == nil {
		defer cur.Close(h.ctx(c))
		_ = cur.All(h.ctx(c), &topTechAgg)
	}
	techIDs := make([]primitive.ObjectID, 0, len(topTechAgg))
	for _, t := range topTechAgg {
		techIDs = append(techIDs, t.ID)
	}
	techNames := map[primitive.ObjectID]string{}
	if len(techIDs) > 0 {
		cur, _ := h.DB.Collection(technicianCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": techIDs}})
		for cur.Next(h.ctx(c)) {
			var t models.Technician
			if err := cur.Decode(&t); err == nil {
				techNames[t.ID] = t.Name
			}
		}
	}
	topTechnicians := make([]fiber.Map, 0, len(topTechAgg))
	for _, t := range topTechAgg {
		topTechnicians = append(topTechnicians, fiber.Map{"id": t.ID.Hex(), "name": techNames[t.ID], "count": t.Count})
	}
	// Top units
	var topUnitsAgg []kv
	if cur, err := h.DB.Collection(bookingCollection).Aggregate(h.ctx(c), mongo.Pipeline{
		{{Key: "$group", Value: bson.M{"_id": "$vehicle_id", "count": bson.M{"$sum": 1}}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
		{{Key: "$limit", Value: 5}},
	}); err == nil {
		defer cur.Close(h.ctx(c))
		_ = cur.All(h.ctx(c), &topUnitsAgg)
	}
	unitIDs := make([]primitive.ObjectID, 0, len(topUnitsAgg))
	for _, u := range topUnitsAgg {
		unitIDs = append(unitIDs, u.ID)
	}
	unitLabels := map[primitive.ObjectID]string{}
	if len(unitIDs) > 0 {
		cur, _ := h.DB.Collection(vehicleCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": unitIDs}})
		for cur.Next(h.ctx(c)) {
			var v models.Vehicle
			if err := cur.Decode(&v); err == nil {
				label := v.Plate
				if label == "" {
					label = v.VIN
				}
				unitLabels[v.ID] = label
			}
		}
	}
	topUnits := make([]fiber.Map, 0, len(topUnitsAgg))
	for _, u := range topUnitsAgg {
		topUnits = append(topUnits, fiber.Map{"id": u.ID.Hex(), "name": unitLabels[u.ID], "count": u.Count})
	}
	// Top companies
	var topCompaniesAgg []kv
	if cur, err := h.DB.Collection(bookingCollection).Aggregate(h.ctx(c), mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"company_id": bson.M{"$ne": primitive.NilObjectID}}}},
		{{Key: "$group", Value: bson.M{"_id": "$company_id", "count": bson.M{"$sum": 1}}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
		{{Key: "$limit", Value: 5}},
	}); err == nil {
		defer cur.Close(h.ctx(c))
		_ = cur.All(h.ctx(c), &topCompaniesAgg)
	}
	companyIDs := make([]primitive.ObjectID, 0, len(topCompaniesAgg))
	for _, u := range topCompaniesAgg {
		companyIDs = append(companyIDs, u.ID)
	}
	companyNames := map[primitive.ObjectID]string{}
	if len(companyIDs) > 0 {
		cur, _ := h.DB.Collection(companyCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": companyIDs}})
		for cur.Next(h.ctx(c)) {
			var v models.Company
			if err := cur.Decode(&v); err == nil {
				companyNames[v.ID] = v.Name
			}
		}
	}
	topCompanies := make([]fiber.Map, 0, len(topCompaniesAgg))
	for _, u := range topCompaniesAgg {
		topCompanies = append(topCompanies, fiber.Map{"id": u.ID.Hex(), "name": companyNames[u.ID], "count": u.Count})
	}
	// Top bays
	var topBaysAgg []kv
	if cur, err := h.DB.Collection(bookingCollection).Aggregate(h.ctx(c), mongo.Pipeline{
		{{Key: "$group", Value: bson.M{"_id": "$bay_id", "count": bson.M{"$sum": 1}}}},
		{{Key: "$sort", Value: bson.M{"count": -1}}},
		{{Key: "$limit", Value: 5}},
	}); err == nil {
		defer cur.Close(h.ctx(c))
		_ = cur.All(h.ctx(c), &topBaysAgg)
	}
	bayIDs := make([]primitive.ObjectID, 0, len(topBaysAgg))
	for _, b := range topBaysAgg {
		bayIDs = append(bayIDs, b.ID)
	}
	bayNames := map[primitive.ObjectID]string{}
	if len(bayIDs) > 0 {
		cur, _ := h.DB.Collection(bayCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": bayIDs}})
		for cur.Next(h.ctx(c)) {
			var v models.Bay
			if err := cur.Decode(&v); err == nil {
				bayNames[v.ID] = v.Name
			}
		}
	}
	topBays := make([]fiber.Map, 0, len(topBaysAgg))
	for _, b := range topBaysAgg {
		topBays = append(topBays, fiber.Map{"id": b.ID.Hex(), "name": bayNames[b.ID], "count": b.Count})
	}

	return c.JSON(fiber.Map{
		"open_bookings":  openCount,
		"today_bookings": todayCount,
		"bays":           baysCount,
		"timestamp":      now,
		"top": fiber.Map{
			"technicians": topTechnicians,
			"units":       topUnits,
			"companies":   topCompanies,
			"bays":        topBays,
		},
	})
}

// Agenda возвращает события в диапазоне дат.
func (h *Handler) Agenda(c *fiber.Ctx) error {
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		return fiber.ErrBadRequest
	}
	// Be tolerant to fractional seconds: try RFC3339 then RFC3339Nano
	parse := func(s string) (time.Time, error) {
		if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
			return t, nil
		}
		return time.Parse(time.RFC3339, s)
	}
	fromTime, err := parse(from)
	if err != nil {
		return fiber.ErrBadRequest
	}
	toTime, err := parse(to)
	if err != nil {
		return fiber.ErrBadRequest
	}

	filter := bson.M{
		"status": bson.M{"$in": []models.BookingStatus{models.BookingOpen, models.BookingInProgress}},
		"start":  bson.M{"$lt": toTime},
		"$or": []bson.M{
			{"end": bson.M{"$gte": fromTime}},
			{"end": bson.M{"$exists": false}},
		},
	}
	// Exclude the special WaitingList bay from calendar agenda
	if wlID, ok := h.findWaitingListBayID(c); ok {
		filter["bay_id"] = bson.M{"$ne": wlID}
	}
	cur, err := h.DB.Collection(bookingCollection).Find(h.ctx(c), filter)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	items := make([]models.Booking, 0)
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

// ReadyBookings returns bookings that were completed (status=closed) within the provided time range.
// We consider bookings "ready" if their end timestamp falls within [from, to).
func (h *Handler) ReadyBookings(c *fiber.Ctx) error {
	from := c.Query("from")
	to := c.Query("to")
	if from == "" || to == "" {
		return fiber.ErrBadRequest
	}
	parse := func(s string) (time.Time, error) {
		if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
			return t, nil
		}
		return time.Parse(time.RFC3339, s)
	}
	fromTime, err := parse(from)
	if err != nil {
		return fiber.ErrBadRequest
	}
	toTime, err := parse(to)
	if err != nil {
		return fiber.ErrBadRequest
	}
	filter := bson.M{
		"status": models.BookingClosed,
		"end": bson.M{
			"$gte": fromTime,
			"$lt":  toTime,
		},
	}
	cur, err := h.DB.Collection(bookingCollection).Find(h.ctx(c), filter, options.Find().SetSort(bson.D{{Key: "end", Value: -1}}))
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

// WaitingListBookings returns bookings assigned to the special WaitingList bay.
// These bookings are not shown on the main calendar and are listed separately.
func (h *Handler) WaitingListBookings(c *fiber.Ctx) error {
	wlID, ok := h.findWaitingListBayID(c)
	if !ok {
		// If there's no WaitingList bay configured, return empty list.
		return c.JSON([]models.Booking{})
	}
	filter := bson.M{
		"bay_id": wlID,
		"status": bson.M{"$in": []models.BookingStatus{models.BookingOpen, models.BookingInProgress}},
	}
	// Keep optional time filters if provided, but do not require them.
	if from := c.Query("from"); from != "" {
		if to := c.Query("to"); to != "" {
			parse := func(s string) (time.Time, error) {
				if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
					return t, nil
				}
				return time.Parse(time.RFC3339, s)
			}
			fromTime, err1 := parse(from)
			toTime, err2 := parse(to)
			if err1 == nil && err2 == nil {
				filter["start"] = bson.M{"$gte": fromTime, "$lt": toTime}
			}
		}
	}
	cur, err := h.DB.Collection(bookingCollection).Find(h.ctx(c), filter, options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}))
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

func (h *Handler) loadBay(c *fiber.Ctx, bayID primitive.ObjectID) (models.Bay, error) {
	var bay models.Bay
	err := h.DB.Collection(bayCollection).FindOne(h.ctx(c), bson.M{"_id": bayID}).Decode(&bay)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return bay, fiber.NewError(fiber.StatusBadRequest, "bay not found")
		}
		return bay, fiber.ErrInternalServerError
	}
	return bay, nil
}

// findWaitingListBayID returns the ObjectID of the bay with key "WaitingList" if present.
func (h *Handler) findWaitingListBayID(c *fiber.Ctx) (primitive.ObjectID, bool) {
	var doc struct {
		ID  primitive.ObjectID `bson:"_id"`
		Key string             `bson:"key"`
	}
	err := h.DB.Collection(bayCollection).FindOne(h.ctx(c), bson.M{"key": "WaitingList"}).Decode(&doc)
	if err != nil {
		return primitive.NilObjectID, false
	}
	return doc.ID, true
}
