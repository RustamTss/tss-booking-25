package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const contactCollection = "contacts"

type contactRequest struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	Email string `json:"email"`
}

// ListCompanyContacts returns contacts for a given company
func (h *Handler) ListCompanyContacts(c *fiber.Ctx) error {
	companyID, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(contactCollection).Find(h.ctx(c), bson.M{"company_id": companyID}, opts)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))
	var items []models.Contact
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

func (h *Handler) CreateCompanyContact(c *fiber.Ctx) error {
	companyID, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req contactRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	now := h.now()
	contact := models.Contact{
		ID:        primitive.NewObjectID(),
		CompanyID: companyID,
		Name:      req.Name,
		Phone:     req.Phone,
		Email:     req.Email,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(contactCollection).InsertOne(h.ctx(c), contact); err != nil {
		return fiber.ErrInternalServerError
	}
	// If company has empty primary contact, backfill from first contact
	_, _ = h.DB.Collection(companyCollection).UpdateByID(h.ctx(c), companyID, bson.M{
		"$set": bson.M{"contact": req.Name, "phone": req.Phone, "updated_at": now},
	})
	return c.Status(fiber.StatusCreated).JSON(contact)
}

func (h *Handler) UpdateContact(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req contactRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{"$set": bson.M{
		"name":       req.Name,
		"phone":      req.Phone,
		"email":      req.Email,
		"updated_at": h.now(),
	}}
	res, err := h.DB.Collection(contactCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) DeleteContact(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(contactCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}
