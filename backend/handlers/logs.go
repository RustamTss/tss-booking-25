package handlers

import (
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
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

	limit := int64(500)
	if n := c.QueryInt("limit"); n > 0 {
		if n > 1000 {
			n = 1000
		}
		limit = int64(n)
	}

	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit)
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
	return c.JSON(logs)
}
