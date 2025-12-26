package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const technicianCollection = "technicians"

type technicianRequest struct {
	Name   string   `json:"name"`
	Skills []string `json:"skills"`
	Phone  string   `json:"phone"`
	Email  string   `json:"email"`
}

func (h *Handler) ListTechnicians(c *fiber.Ctx) error {
	cur, err := h.DB.Collection(technicianCollection).Find(h.ctx(c), bson.D{})
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
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateTechnician(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
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
