package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const technicianCollection = "technicians"
const auditCollection = "audit_logs"

type technicianRequest struct {
	Name   string   `json:"name"`
	Skills []string `json:"skills"`
	Phone  string   `json:"phone"`
	Email  string   `json:"email"`
}

func (h *Handler) ListTechnicians(c *fiber.Ctx) error {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(technicianCollection).Find(h.ctx(c), bson.D{}, opts)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Technician
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

// GetOneTechnician returns technician by id
func (h *Handler) GetOneTechnician(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var t models.Technician
	if err := h.DB.Collection(technicianCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&t); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
	}
	return c.JSON(t)
}

func (h *Handler) CreateTechnician(c *fiber.Ctx) error {
	var req technicianRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	now := h.now()
	item := models.Technician{
		ID:        primitive.NewObjectID(),
		Name:      req.Name,
		Skills:    req.Skills,
		Phone:     req.Phone,
		Email:     req.Email,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(technicianCollection).InsertOne(h.ctx(c), item); err != nil {
		return fiber.ErrInternalServerError
	}
	// audit: technician created
	{
		var userID primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id, err := primitive.ObjectIDFromHex(uid); err == nil {
				userID = id
			}
		}
		logItem := models.AuditLog{
			ID:       primitive.NewObjectID(),
			Action:   "technician.created",
			Entity:   "technician",
			EntityID: item.ID,
			UserID:   userID,
			Meta: bson.M{
				"name":   item.Name,
				"skills": item.Skills,
				"phone":  item.Phone,
				"email":  item.Email,
			},
			CreatedAt: now,
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), logItem)
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateTechnician(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	// load existing for diff
	var prev models.Technician
	_ = h.DB.Collection(technicianCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&prev)
	var req technicianRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{
		"$set": bson.M{
			"name":       req.Name,
			"skills":     req.Skills,
			"phone":      req.Phone,
			"email":      req.Email,
			"updated_at": h.now(),
		},
	}
	res, err := h.DB.Collection(technicianCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	// audit: technician updated (diff)
	{
		changes := bson.M{}
		if prev.Name != req.Name {
			changes["name"] = bson.M{"from": prev.Name, "to": req.Name}
		}
		if len(prev.Skills) != len(req.Skills) {
			changes["skills"] = bson.M{"from": prev.Skills, "to": req.Skills}
		} else {
			eq := true
			for i := range prev.Skills {
				if prev.Skills[i] != req.Skills[i] {
					eq = false
					break
				}
			}
			if !eq {
				changes["skills"] = bson.M{"from": prev.Skills, "to": req.Skills}
			}
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
				Action:    "technician.updated",
				Entity:    "technician",
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

func (h *Handler) DeleteTechnician(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(technicianCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// ListTechnicianLogs returns audit logs related to the technician.
func (h *Handler) ListTechnicianLogs(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), bson.M{
		"entity":    "technician",
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
