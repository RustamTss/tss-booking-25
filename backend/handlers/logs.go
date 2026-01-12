package handlers

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
	"strings"
)

// ListAllLogs returns audit logs across the system with optional filters.
// Query params:
// - user_id: filter by actor user id
// - entity: filter by entity type (booking, technician, bay, company, vehicle, user)
// - action: filter by action string (e.g. booking.created)
// - limit: maximum number of records to return (1..1000, default 500)
func (h *Handler) ListAllLogs(c *fiber.Ctx) error {
	filter := bson.M{}
	if v := c.Query("user_id"); v != "" {
		if id, err := primitive.ObjectIDFromHex(v); err == nil {
			filter["user_id"] = id
		}
	}
	if v := c.Query("entity"); v != "" {
		filter["entity"] = v
	}
	if v := c.Query("action"); v != "" {
		filter["action"] = v
	}

	limit := int64(c.QueryInt("limit", 50))
	if limit <= 0 {
		limit = 50
	}
	if limit > 1000 {
		limit = 1000
	}
	page := int64(c.QueryInt("page", 1))
	if page <= 0 {
		page = 1
	}
	skip := (page - 1) * limit

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip)
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), filter, opts)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var logs []bson.M
	if err := cur.All(h.ctx(c), &logs); err != nil {
		return fiber.ErrInternalServerError
	}
	// Normalize ids to hex strings for frontend
	for _, m := range logs {
		if id, ok := m["_id"].(primitive.ObjectID); ok {
			m["id"] = id.Hex()
			delete(m, "_id")
		}
		if uid, ok := m["user_id"].(primitive.ObjectID); ok {
			m["user_id"] = uid.Hex()
		}
		if eid, ok := m["entity_id"].(primitive.ObjectID); ok {
			m["entity_id"] = eid.Hex()
		}
	}
	if strings.ToLower(c.Query("envelope")) == "1" || strings.ToLower(c.Query("envelope")) == "true" {
		// Counting with same filter
		total, _ := h.DB.Collection(auditCollection).CountDocuments(h.ctx(c), filter)
		totalPages := (total + limit - 1) / limit
		return c.JSON(fiber.Map{
			"data": logs,
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
	return c.JSON(logs)
}
