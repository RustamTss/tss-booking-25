package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const bayCollection = "bays"

type bayRequest struct {
	Name     string `json:"name"`
	Capacity int    `json:"capacity"`
}

func (h *Handler) ListBays(c *fiber.Ctx) error {
	cur, err := h.DB.Collection(bayCollection).Find(h.ctx(c), bson.D{})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Bay
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

func (h *Handler) CreateBay(c *fiber.Ctx) error {
	var req bayRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Capacity <= 0 {
		req.Capacity = 3
	}
	if req.Capacity > 3 {
		req.Capacity = 3
	}
	now := h.now()
	item := models.Bay{
		ID:        primitive.NewObjectID(),
		Name:      req.Name,
		Capacity:  req.Capacity,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(bayCollection).InsertOne(h.ctx(c), item); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateBay(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req bayRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Capacity <= 0 {
		req.Capacity = 3
	}
	if req.Capacity > 3 {
		req.Capacity = 3
	}
	update := bson.M{
		"$set": bson.M{
			"name":       req.Name,
			"capacity":   req.Capacity,
			"updated_at": h.now(),
		},
	}
	res, err := h.DB.Collection(bayCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) DeleteBay(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(bayCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}
