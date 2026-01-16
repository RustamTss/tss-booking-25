package handlers

import (
	"bytes"
	"encoding/csv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const serviceWriterCollection = "service_writers"

type serviceWriterRequest struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	Email string `json:"email"`
}

func (h *Handler) ListServiceWriters(c *fiber.Ctx) error {
	filter := bson.D{}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		filter = append(filter, bson.E{
			Key: "$or", Value: []bson.M{
				{"name": bson.M{"$regex": q, "$options": "i"}},
				{"phone": bson.M{"$regex": q, "$options": "i"}},
				{"email": bson.M{"$regex": q, "$options": "i"}},
			},
		})
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
	opts := options.Find().
		SetSort(bson.D{
			{Key: "created_at", Value: -1},
			{Key: "_id", Value: -1},
		}).
		SetLimit(limit).
		SetSkip(skip)
	cur, err := h.DB.Collection(serviceWriterCollection).Find(h.ctx(c), filter, opts)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.ServiceWriter
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	// CSV export
	if exp := strings.ToLower(c.Query("export")); exp == "csv" || exp == "excel" {
		var buf bytes.Buffer
		w := csv.NewWriter(&buf)
		_ = w.Write([]string{"name", "phone", "email", "created_at"})
		for _, t := range items {
			_ = w.Write([]string{
				t.Name,
				t.Phone,
				t.Email,
				t.CreatedAt.In(h.TZ).Format("01/02/2006, 03:04 PM"),
			})
		}
		w.Flush()
		c.Set("Content-Type", "text/csv")
		c.Set("Content-Disposition", "attachment; filename=\"service_writers.csv\"")
		return c.Send(buf.Bytes())
	}
	// envelope
	if strings.ToLower(c.Query("envelope")) == "1" || strings.ToLower(c.Query("envelope")) == "true" {
		total, err := h.DB.Collection(serviceWriterCollection).CountDocuments(h.ctx(c), filter)
		if err != nil {
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

func (h *Handler) GetOneServiceWriter(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var t models.ServiceWriter
	if err := h.DB.Collection(serviceWriterCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&t); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
	}
	return c.JSON(t)
}

func (h *Handler) CreateServiceWriter(c *fiber.Ctx) error {
	var req serviceWriterRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	now := h.now()
	item := models.ServiceWriter{
		ID:        primitive.NewObjectID(),
		Name:      req.Name,
		Phone:     req.Phone,
		Email:     req.Email,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(serviceWriterCollection).InsertOne(h.ctx(c), item); err != nil {
		return fiber.ErrInternalServerError
	}
	// audit
	{
		var userID primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id, err := primitive.ObjectIDFromHex(uid); err == nil {
				userID = id
			}
		}
		logItem := models.AuditLog{
			ID:       primitive.NewObjectID(),
			Action:   "service_writer.created",
			Entity:   "service_writer",
			EntityID: item.ID,
			UserID:   userID,
			Meta: bson.M{
				"name":  item.Name,
				"phone": item.Phone,
				"email": item.Email,
			},
			CreatedAt: now,
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), logItem)
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateServiceWriter(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	// load existing
	var prev models.ServiceWriter
	_ = h.DB.Collection(serviceWriterCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&prev)

	var req serviceWriterRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{
		"$set": bson.M{
			"name":       req.Name,
			"phone":      req.Phone,
			"email":      req.Email,
			"updated_at": h.now(),
		},
	}
	res, err := h.DB.Collection(serviceWriterCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	// audit diff
	{
		changes := bson.M{}
		if prev.Name != req.Name {
			changes["name"] = bson.M{"from": prev.Name, "to": req.Name}
		}
		if prev.Phone != req.Phone {
			changes["phone"] = bson.M{"from": prev.Phone, "to": req.Phone}
		}
		if prev.Email != req.Email {
			changes["email"] = bson.M{"from": prev.Email, "to": req.Email}
		}
		if len(changes) > 0 {
			var userID primitive.ObjectID
			if uid := getUserID(c); uid != "" {
				if u, err := primitive.ObjectIDFromHex(uid); err == nil {
					userID = u
				}
			}
			logItem := models.AuditLog{
				ID:        primitive.NewObjectID(),
				Action:    "service_writer.updated",
				Entity:    "service_writer",
				EntityID:  id,
				UserID:    userID,
				Meta:      changes,
				CreatedAt: h.now(),
			}
			_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), logItem)
		}
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) DeleteServiceWriter(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(serviceWriterCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ListServiceWriterLogs returns audit logs related to the service writer.
func (h *Handler) ListServiceWriterLogs(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), bson.M{
		"entity":    "service_writer",
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

