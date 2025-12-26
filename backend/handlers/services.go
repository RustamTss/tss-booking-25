package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const serviceCollection = "services"

type serviceRequest struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	DurationMinutes int    `json:"duration_minutes"`
	PriceCents      int64  `json:"price_cents"`
}

func (h *Handler) ListServices(c *fiber.Ctx) error {
	cur, err := h.DB.Collection(serviceCollection).Find(h.ctx(c), bson.D{})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Service
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

func (h *Handler) CreateService(c *fiber.Ctx) error {
	var req serviceRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	now := h.now()
	item := models.Service{
		ID:              primitive.NewObjectID(),
		Name:            req.Name,
		Description:     req.Description,
		DurationMinutes: req.DurationMinutes,
		PriceCents:      req.PriceCents,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if _, err := h.DB.Collection(serviceCollection).InsertOne(h.ctx(c), item); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateService(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req serviceRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{
		"$set": bson.M{
			"name":             req.Name,
			"description":      req.Description,
			"duration_minutes": req.DurationMinutes,
			"price_cents":      req.PriceCents,
			"updated_at":       h.now(),
		},
	}
	res, err := h.DB.Collection(serviceCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) DeleteService(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(serviceCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}
