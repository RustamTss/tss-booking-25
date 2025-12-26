package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const vehicleCollection = "vehicles"

type vehicleRequest struct {
	CompanyID string             `json:"company_id"`
	Type      models.VehicleType `json:"type"`
	VIN       string             `json:"vin"`
	Plate     string             `json:"plate"`
	Make      string             `json:"make"`
	Model     string             `json:"model"`
	Year      int                `json:"year"`
}

func (h *Handler) ListVehicles(c *fiber.Ctx) error {
	cur, err := h.DB.Collection(vehicleCollection).Find(h.ctx(c), bson.D{})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Vehicle
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(items)
}

func (h *Handler) CreateVehicle(c *fiber.Ctx) error {
	var req vehicleRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}

	companyID, err := asObjectID(req.CompanyID)
	if err != nil {
		return fiber.ErrBadRequest
	}

	now := h.now()
	item := models.Vehicle{
		ID:        primitive.NewObjectID(),
		CompanyID: companyID,
		Type:      req.Type,
		VIN:       req.VIN,
		Plate:     req.Plate,
		Make:      req.Make,
		Model:     req.Model,
		Year:      req.Year,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(vehicleCollection).InsertOne(h.ctx(c), item); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateVehicle(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req vehicleRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	companyID, err := asObjectID(req.CompanyID)
	if err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{
		"$set": bson.M{
			"company_id": companyID,
			"type":       req.Type,
			"vin":        req.VIN,
			"plate":      req.Plate,
			"make":       req.Make,
			"model":      req.Model,
			"year":       req.Year,
			"updated_at": h.now(),
		},
	}
	res, err := h.DB.Collection(vehicleCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) DeleteVehicle(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(vehicleCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}
