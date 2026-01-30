package handlers

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const requestCollection = "requests"

// RequestWebhook accepts POSTs from no-code/telegram bot and creates a Request.
// Secure with WEBHOOK_TOKEN via query (?token=) or Authorization header ("Bearer <token>").
func (h *Handler) RequestWebhook(c *fiber.Ctx) error {
	secret := os.Getenv("WEBHOOK_TOKEN")
	if secret == "" {
		return fiber.ErrForbidden
	}
	auth := string(c.Request().Header.Peek("Authorization"))
	token := c.Query("token")
	ok := false
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") && strings.TrimSpace(auth[7:]) == secret {
		ok = true
	}
	if token != "" && token == secret {
		ok = true
	}
	if !ok {
		return fiber.ErrForbidden
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return fiber.ErrBadRequest
	}

	get := func(keys ...string) string {
		for _, k := range keys {
			if v, exists := body[k]; exists && v != nil {
				if s, ok := v.(string); ok {
					s = strings.TrimSpace(s)
					if s != "" {
						return s
					}
				}
			}
		}
		return ""
	}

	company := get("company_name", "Company Name", "company", "Company")
	driver := get("driver_name", "Driver Name", "driver")
	phone := get("phone", "Phone", "phone_number", "Phone Number")
	unit := get("unit_number", "Unit Number", "unit", "Unit")
	startRaw := get("start_datetime", "Start Date Time", "start_at", "Start")
	username := get("username", "Username", "telegram_username", "Telegram Username")
	userID := get("user_id", "User ID", "telegram_user_id", "Telegram User ID", "chat_id")
	issue := get("service_issue", "Issue", "issue")
	contactID := get("contact_id", "Contact ID", "contactid")

	var startAt time.Time
	var startPtr *time.Time
	if startRaw != "" {
		// Prefer ISO-8601 first (with timezone info)
		if t, err := time.Parse(time.RFC3339Nano, startRaw); err == nil {
			startAt = t
		} else if t, err := time.Parse(time.RFC3339, startRaw); err == nil {
			startAt = t
		} else {
			// Tolerant parsing for common local formats; assume shop timezone (h.TZ)
			formats := []string{
				"02.01.2006 15:04", // dd.MM.yyyy HH:mm  (e.g. 13.01.2026 12:00)
				"01/02/2006 15:04", // MM/dd/yyyy HH:mm
				"2006-01-02 15:04", // yyyy-MM-dd HH:mm
			}
			for _, f := range formats {
				if t, err := time.ParseInLocation(f, startRaw, h.TZ); err == nil {
					startAt = t
					break
				}
			}
		}
	}
	if !startAt.IsZero() {
		startPtr = &startAt
	}

	req := models.Request{
		ID:           primitive.NewObjectID(),
		CompanyName:  company,
		DriverName:   driver,
		Phone:        phone,
		UnitNumber:   unit,
		StartAt:      startPtr,
		Status:       models.RequestNew,
		Source:       "telegram_bot",
		Username:     username,
		UserID:       userID,
		ServiceIssue: issue,
		ContactID:    contactID,
		CreatedAt:    h.now(),
		UpdatedAt:    h.now(),
	}
	if _, err := h.DB.Collection(requestCollection).InsertOne(h.ctx(c), req); err != nil {
		return fiber.ErrInternalServerError
	}
	// Realtime
	pushRealtime(models.RealtimeEvent{Type: "request.created", Data: req})
	// Group notification in rich format (avoid zero dates and dummy numbers)
	{
		startText := ""
		if req.StartAt != nil && !req.StartAt.IsZero() {
			startText = req.StartAt.In(h.TZ).Format("01/02/2006, 03:04 PM")
		}
		escape := func(s string) string {
			s = strings.ReplaceAll(s, "&", "&amp;")
			s = strings.ReplaceAll(s, "<", "&lt;")
			s = strings.ReplaceAll(s, ">", "&gt;")
			return s
		}
		var sb strings.Builder
		// Header line (no number for requests)
		sb.WriteString("📨 <b>New service request</b>\n\n")
		if strings.TrimSpace(req.ServiceIssue) != "" {
			sb.WriteString("<b>Service issue:</b> ")
			sb.WriteString(escape(req.ServiceIssue))
			sb.WriteString("\n")
		}
		if strings.TrimSpace(req.DriverName) != "" {
			sb.WriteString("<b>Driver:</b> ")
			sb.WriteString(escape(req.DriverName))
			sb.WriteString("\n")
		}
		if strings.TrimSpace(req.Phone) != "" {
			sb.WriteString("<b>Phone:</b> ")
			sb.WriteString(escape(req.Phone))
			sb.WriteString("\n")
		}
		if strings.TrimSpace(req.CompanyName) != "" {
			sb.WriteString("<b>Company:</b> ")
			sb.WriteString(escape(req.CompanyName))
			sb.WriteString("\n")
		}
		if strings.TrimSpace(req.UnitNumber) != "" {
			sb.WriteString("<b>Unit:</b> ")
			sb.WriteString(escape(req.UnitNumber))
			sb.WriteString("\n")
		}
		if startText != "" {
			sb.WriteString("<b>Start:</b> ")
			sb.WriteString(escape(startText))
			sb.WriteString("\n")
		}
		_ = h.Telegram.Notify(sb.String())
	}
	return c.SendStatus(fiber.StatusOK)
}

// ListRequests returns requests, optionally filtered by status.
func (h *Handler) ListRequests(c *fiber.Ctx) error {
	filter := bson.M{}
	if v := strings.TrimSpace(c.Query("status")); v != "" {
		filter["status"] = models.RequestStatus(v)
	}
	// free text search
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		filter["$or"] = []bson.M{
			{"driver_name": bson.M{"$regex": q, "$options": "i"}},
			{"phone": bson.M{"$regex": q, "$options": "i"}},
			{"company_name": bson.M{"$regex": q, "$options": "i"}},
			{"unit_number": bson.M{"$regex": q, "$options": "i"}},
			{"username": bson.M{"$regex": q, "$options": "i"}},
			{"service_issue": bson.M{"$regex": q, "$options": "i"}},
		}
	}
	limit := int64(c.QueryInt("limit", 50))
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	page := int64(c.QueryInt("page", 1))
	if page <= 0 {
		page = 1
	}
	skip := (page - 1) * limit
	cur, err := h.DB.Collection(requestCollection).Find(h.ctx(c), filter, options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip))
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))
	var items []models.Request
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	// Normalize zero times to nil so clients don't see 0001-01-01
	for i := range items {
		if items[i].StartAt != nil && items[i].StartAt.IsZero() {
			items[i].StartAt = nil
		}
	}
	if strings.ToLower(c.Query("envelope")) == "1" || strings.ToLower(c.Query("envelope")) == "true" {
		total, err := h.DB.Collection(requestCollection).CountDocuments(h.ctx(c), filter)
		if err != nil && err != mongo.ErrNoDocuments {
			return fiber.ErrInternalServerError
		}
		totalPages := (total + limit - 1) / limit
		return c.JSON(fiber.Map{
			"data": items,
			"pagination": fiber.Map{
				"total":       total,
				"page":        page,
				"limit":       limit,
				"totalPages":  totalPages,
				"hasNextPage": page < totalPages,
				"hasPrevPage": page > 1,
			},
		})
	}
	return c.JSON(items)
}

// GetRequest returns one request by id
func (h *Handler) GetRequest(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var r models.Request
	if err := h.DB.Collection(requestCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&r); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
	}
	if r.StartAt != nil && r.StartAt.IsZero() {
		r.StartAt = nil
	}
	return c.JSON(r)
}

// UpdateRequest updates status of a request
func (h *Handler) UpdateRequest(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var payload struct {
		Status *models.RequestStatus `json:"status"`
	}
	if err := c.BodyParser(&payload); err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{"updated_at": h.now()}
	if payload.Status != nil {
		update["status"] = *payload.Status
	}
	res, err := h.DB.Collection(requestCollection).UpdateByID(h.ctx(c), id, bson.M{"$set": update})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	pushRealtime(models.RealtimeEvent{Type: "request.updated", Data: id.Hex()})

	// Post-update: if status changed to approved/rejected/in_review and we have contact_id, send SendPulse message.
	if payload.Status != nil && (*payload.Status == models.RequestApproved || *payload.Status == models.RequestRejected || *payload.Status == models.RequestInReview) {
		var r models.Request
		if err := h.DB.Collection(requestCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&r); err == nil {
			if strings.TrimSpace(r.ContactID) != "" && h.SendPulse != nil {
				statusText := "Approved ✅"
				if *payload.Status == models.RequestRejected {
					statusText = "Rejected ❌"
				} else if *payload.Status == models.RequestInReview {
					statusText = "Under Review"
				}
				startText := ""
				if r.StartAt != nil && !r.StartAt.IsZero() {
					startText = r.StartAt.In(h.TZ).Format("01/02/2006, 03:04 PM")
				}
				escape := func(s string) string {
					s = strings.ReplaceAll(s, "&", "&amp;")
					s = strings.ReplaceAll(s, "<", "&lt;")
					s = strings.ReplaceAll(s, ">", "&gt;")
					return s
				}
				lines := []string{
					fmt.Sprintf("<b>Status:</b> %s", statusText),
					fmt.Sprintf("<b>Service issue:</b> %s", escape(r.ServiceIssue)),
					fmt.Sprintf("<b>Driver:</b> %s", escape(r.DriverName)),
					fmt.Sprintf("<b>Phone:</b> %s", escape(r.Phone)),
					fmt.Sprintf("<b>Company:</b> %s", escape(r.CompanyName)),
					fmt.Sprintf("<b>Unit:</b> %s", escape(r.UnitNumber)),
					fmt.Sprintf("<b>Start:</b> %s", escape(startText)),
				}
				html := strings.Join(lines, "\n")
				// best-effort send; do not block or fail the request if send fails
				go func(contactID, msg string) {
					_ = h.SendPulse.SendHTML(context.Background(), contactID, msg)
				}(r.ContactID, html)
			}
		}
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// DeleteRequest removes a request (admin only)
func (h *Handler) DeleteRequest(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(requestCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	// Audit who deleted (include email if available)
	{
		var actorID primitive.ObjectID
		var actorEmail string
		if uid := getUserID(c); uid != "" {
			if oid, err := primitive.ObjectIDFromHex(uid); err == nil {
				actorID = oid
				var u models.User
				_ = h.DB.Collection(userCollection).FindOne(h.ctx(c), bson.M{"_id": oid}).Decode(&u)
				actorEmail = u.Email
			}
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
			ID:        primitive.NewObjectID(),
			Action:    "request.deleted",
			Entity:    "request",
			EntityID:  id,
			UserID:    actorID,
			Meta:      bson.M{"email": actorEmail},
			CreatedAt: h.now(),
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
