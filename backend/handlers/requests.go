package handlers

import (
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

	var startAt time.Time
	if startRaw != "" {
		if t, err := time.Parse(time.RFC3339Nano, startRaw); err == nil {
			startAt = t
		} else if t, err := time.Parse(time.RFC3339, startRaw); err == nil {
			startAt = t
		} else if t, err := time.Parse("01/02/2006 15:04", startRaw); err == nil {
			startAt = t
		} else if t, err := time.Parse("2006-01-02 15:04", startRaw); err == nil {
			startAt = t
		}
	}
	if startAt.IsZero() {
		startAt = h.now()
	}

	req := models.Request{
		ID:          primitive.NewObjectID(),
		CompanyName: company,
		DriverName:  driver,
		Phone:       phone,
		UnitNumber:  unit,
		StartAt:     startAt,
		Status:      models.RequestNew,
		Source:      "telegram_bot",
		CreatedAt:   h.now(),
		UpdatedAt:   h.now(),
	}
	if _, err := h.DB.Collection(requestCollection).InsertOne(h.ctx(c), req); err != nil {
		return fiber.ErrInternalServerError
	}
	// Realtime
	pushRealtime(models.RealtimeEvent{Type: "request.created", Data: req})
	// Optional telegram summary
	data := map[string]string{
		"company_name": req.CompanyName,
		"driver_name":  req.DriverName,
		"phone":        req.Phone,
		"unit_number":  req.UnitNumber,
		"start_at":     req.StartAt.In(h.TZ).Format("01/02/2006, 03:04 PM"),
	}
	_ = h.Telegram.Notify(h.renderTelegramFallback("request", models.Booking{}, data))
	return c.SendStatus(fiber.StatusOK)
}

// ListRequests returns requests, optionally filtered by status.
func (h *Handler) ListRequests(c *fiber.Ctx) error {
	filter := bson.M{}
	if v := strings.TrimSpace(c.Query("status")); v != "" {
		filter["status"] = models.RequestStatus(v)
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
	if strings.ToLower(c.Query("envelope")) == "1" || strings.ToLower(c.Query("envelope")) == "true" {
		total, err := h.DB.Collection(requestCollection).CountDocuments(h.ctx(c), filter)
		if err != nil && err != mongo.ErrNoDocuments {
			return fiber.ErrInternalServerError
		}
		totalPages := (total + limit - 1) / limit
		return c.JSON(fiber.Map{
			"data": items,
			"pagination": fiber.Map{
				"total":        total,
				"page":         page,
				"limit":        limit,
				"totalPages":   totalPages,
				"hasNextPage":  page < totalPages,
				"hasPrevPage":  page > 1,
			},
		})
	}
	return c.JSON(items)
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
	return c.SendStatus(fiber.StatusNoContent)
}
