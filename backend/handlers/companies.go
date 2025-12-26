package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const companyCollection = "companies"

type companyRequest struct {
	Name    string `json:"name"`
	Contact string `json:"contact"`
	Phone   string `json:"phone"`
}

func (h *Handler) ListCompanies(c *fiber.Ctx) error {
	cur, err := h.DB.Collection(companyCollection).Find(h.ctx(c), bson.D{})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Company
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

func (h *Handler) CreateCompany(c *fiber.Ctx) error {
	var req companyRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	now := h.now()
	item := models.Company{
		ID:        primitive.NewObjectID(),
		Name:      req.Name,
		Contact:   req.Contact,
		Phone:     req.Phone,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(companyCollection).InsertOne(h.ctx(c), item); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateCompany(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req companyRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{
		"$set": bson.M{
			"name":       req.Name,
			"contact":    req.Contact,
			"phone":      req.Phone,
			"updated_at": h.now(),
		},
	}
	res, err := h.DB.Collection(companyCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) DeleteCompany(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(companyCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}
