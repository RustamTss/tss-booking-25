package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const vehicleCollection = "vehicles"

type vehicleRequest struct {
	CompanyID string             `json:"company_id"`
	Type      models.VehicleType `json:"type"`
	VIN       string             `json:"vin"`
	Plate     string             `json:"plate"`
	Nickname  string             `json:"nickname"`
	Make      string             `json:"make"`
	Model     string             `json:"model"`
	Year      int                `json:"year"`
}

func (h *Handler) ListVehicles(c *fiber.Ctx) error {
	filter := bson.D{}
	if cid := c.Query("company_id"); cid != "" {
		if id, err := asObjectID(cid); err == nil {
			filter = bson.D{{Key: "company_id", Value: id}}
		} else {
			return fiber.ErrBadRequest
		}
	}
	// search
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		filter = append(filter, bson.E{Key: "$or", Value: []bson.M{
			{"plate": bson.M{"$regex": q, "$options": "i"}},
			{"nickname": bson.M{"$regex": q, "$options": "i"}},
			{"vin": bson.M{"$regex": q, "$options": "i"}},
			{"make": bson.M{"$regex": q, "$options": "i"}},
			{"model": bson.M{"$regex": q, "$options": "i"}},
		}})
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
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetLimit(limit).
		SetSkip(skip)
	cur, err := h.DB.Collection(vehicleCollection).Find(h.ctx(c), filter, opts)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var items []models.Vehicle
	if err := cur.All(h.ctx(c), &items); err != nil {
		return fiber.ErrInternalServerError
	}
	// Enrich with company names so clients can show "Plate (Company)"
	idsSet := map[primitive.ObjectID]struct{}{}
	for _, v := range items {
		if v.CompanyID != primitive.NilObjectID {
			idsSet[v.CompanyID] = struct{}{}
		}
	}
	ids := make([]primitive.ObjectID, 0, len(idsSet))
	for id := range idsSet {
		ids = append(ids, id)
	}
	nameByID := map[primitive.ObjectID]string{}
	if len(ids) > 0 {
		ccur, err := h.DB.Collection(companyCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": ids}})
		if err == nil {
			defer ccur.Close(h.ctx(c))
			for ccur.Next(h.ctx(c)) {
				var comp models.Company
				if err := ccur.Decode(&comp); err == nil {
					nameByID[comp.ID] = comp.Name
				}
			}
		}
	}
	type vehicleOut struct {
		models.Vehicle `bson:",inline" json:",inline"`
		CompanyName    string `json:"company_name,omitempty"`
	}
	out := make([]vehicleOut, 0, len(items))
	for _, v := range items {
		out = append(out, vehicleOut{
			Vehicle:     v,
			CompanyName: nameByID[v.CompanyID],
		})
	}
	return c.JSON(out)
}

// GetVehicle returns one vehicle by id
func (h *Handler) GetVehicle(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var v models.Vehicle
	if err := h.DB.Collection(vehicleCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&v); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(v)
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
		Nickname:  req.Nickname,
		Make:      req.Make,
		Model:     req.Model,
		Year:      req.Year,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(vehicleCollection).InsertOne(h.ctx(c), item); err != nil {
		return fiber.ErrInternalServerError
	}
	// audit: vehicle created
	{
		var actor primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id, err := primitive.ObjectIDFromHex(uid); err == nil {
				actor = id
			}
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
			ID:        primitive.NewObjectID(),
			Action:    "vehicle.created",
			Entity:    "vehicle",
			EntityID:  item.ID,
			UserID:    actor,
			Meta:      bson.M{"plate": item.Plate, "vin": item.VIN, "make": item.Make, "model": item.Model, "year": item.Year},
			CreatedAt: now,
		})
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
			"nickname":   req.Nickname,
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
	// audit diffs
	{
		var prev models.Vehicle
		if err := h.DB.Collection(vehicleCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&prev); err == nil {
			changes := bson.M{}
			if prev.Plate != req.Plate {
				changes["plate"] = bson.M{"from": prev.Plate, "to": req.Plate}
			}
			if prev.VIN != req.VIN {
				changes["vin"] = bson.M{"from": prev.VIN, "to": req.VIN}
			}
			if prev.Nickname != req.Nickname {
				changes["nickname"] = bson.M{"from": prev.Nickname, "to": req.Nickname}
			}
			if prev.Make != req.Make {
				changes["make"] = bson.M{"from": prev.Make, "to": req.Make}
			}
			if prev.Model != req.Model {
				changes["model"] = bson.M{"from": prev.Model, "to": req.Model}
			}
			if prev.Year != req.Year {
				changes["year"] = bson.M{"from": prev.Year, "to": req.Year}
			}
			if len(changes) > 0 {
				var actor primitive.ObjectID
				if uid := getUserID(c); uid != "" {
					if id2, err := primitive.ObjectIDFromHex(uid); err == nil {
						actor = id2
					}
				}
				_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
					ID:        primitive.NewObjectID(),
					Action:    "vehicle.updated",
					Entity:    "vehicle",
					EntityID:  id,
					UserID:    actor,
					Meta:      changes,
					CreatedAt: h.now(),
				})
			}
		} else if err != mongo.ErrNoDocuments {
			return fiber.ErrInternalServerError
		}
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

// ListVehicleLogs returns audit logs for a vehicle
func (h *Handler) ListVehicleLogs(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), bson.M{
		"entity":    "vehicle",
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
