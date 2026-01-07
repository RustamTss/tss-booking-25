package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const bayCollection = "bays"
const bookingColForBay = "bookings"

type bayCreateRequest struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

type bayRequest struct {
	Key  string `json:"key"`
	Name string `json:"name"`
}

func (h *Handler) ListBays(c *fiber.Ctx) error {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(bayCollection).Find(h.ctx(c), bson.D{}, opts)
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

// GetBay returns bay by id
func (h *Handler) GetBay(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var b models.Bay
	if err := h.DB.Collection(bayCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&b); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(b)
}

func (h *Handler) CreateBay(c *fiber.Ctx) error {
	var req bayCreateRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Key == "" || req.Name == "" {
		return fiber.ErrBadRequest
	}
	now := h.now()
	item := models.Bay{
		ID:        primitive.NewObjectID(),
		Key:       req.Key,
		Name:      req.Name,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := h.DB.Collection(bayCollection).InsertOne(h.ctx(c), item); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return fiber.NewError(fiber.StatusConflict, "bay key already exists")
		}
		return fiber.ErrInternalServerError
	}
	// audit: bay created
	{
		var actor primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id, err := primitive.ObjectIDFromHex(uid); err == nil {
				actor = id
			}
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
			ID:        primitive.NewObjectID(),
			Action:    "bay.created",
			Entity:    "bay",
			EntityID:  item.ID,
			UserID:    actor,
			Meta:      bson.M{"name": item.Name, "key": item.Key},
			CreatedAt: now,
		})
	}
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateBay(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var prev models.Bay
	_ = h.DB.Collection(bayCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&prev)
	var req bayRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	update := bson.M{
		"$set": bson.M{
			"key":        req.Key,
			"name":       req.Name,
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
	// audit: bay updated diffs
	{
		changes := bson.M{}
		if prev.Key != req.Key && req.Key != "" {
			changes["key"] = bson.M{"from": prev.Key, "to": req.Key}
		}
		if prev.Name != req.Name {
			changes["name"] = bson.M{"from": prev.Name, "to": req.Name}
		}
		if len(changes) > 0 {
			var actor primitive.ObjectID
			if uid := getUserID(c); uid != "" {
				if id, err := primitive.ObjectIDFromHex(uid); err == nil {
					actor = id
				}
			}
			_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
				ID:        primitive.NewObjectID(),
				Action:    "bay.updated",
				Entity:    "bay",
				EntityID:  id,
				UserID:    actor,
				Meta:      changes,
				CreatedAt: h.now(),
			})
		}
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

// ListBayLogs returns audit logs for a bay
func (h *Handler) ListBayLogs(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), bson.M{
		"entity":    "bay",
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

// ListBayOccupancy returns current occupancy per bay at given timestamp (default: now).
// A bay is considered occupied if there exists a booking with status open/in_progress,
// start <= at, and (end >= at or end is missing).
func (h *Handler) ListBayOccupancy(c *fiber.Ctx) error {
	atStr := c.Query("at", "")
	var at time.Time
	if atStr == "" {
		at = h.now()
	} else {
		// flexible parsing
		if t, err := time.Parse(time.RFC3339Nano, atStr); err == nil {
			at = t
		} else if t, err2 := time.Parse(time.RFC3339, atStr); err2 == nil {
			at = t
		} else {
			return fiber.ErrBadRequest
		}
	}
	filter := bson.M{
		"status": bson.M{"$in": []models.BookingStatus{models.BookingOpen, models.BookingInProgress}},
		"start":  bson.M{"$lte": at},
		"$or": []bson.M{
			{"end": bson.M{"$gte": at}},
			{"end": bson.M{"$exists": false}},
		},
	}
	proj := bson.M{
		"_id":         1,
		"number":      1,
		"bay_id":      1,
		"vehicle_id":  1,
		"company_id":  1,
		"start":       1,
		"end":         1,
		"status":      1,
		"complaint":   1,
		"description": 1,
	}
	cur, err := h.DB.Collection(bookingColForBay).Find(h.ctx(c), filter, options.Find().SetProjection(proj))
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	type bookingLite struct {
		ID          primitive.ObjectID   `bson:"_id" json:"id"`
		Number      string               `bson:"number" json:"number"`
		BayID       primitive.ObjectID   `bson:"bay_id" json:"bay_id"`
		VehicleID   primitive.ObjectID   `bson:"vehicle_id" json:"vehicle_id"`
		CompanyID   primitive.ObjectID   `bson:"company_id" json:"company_id"`
		Start       time.Time            `bson:"start" json:"start"`
		End         *time.Time           `bson:"end,omitempty" json:"end,omitempty"`
		Status      models.BookingStatus `bson:"status" json:"status"`
		Complaint   string               `bson:"complaint,omitempty" json:"complaint,omitempty"`
		Description string               `bson:"description,omitempty" json:"description,omitempty"`
	}
	occ := map[string]bookingLite{}
	for cur.Next(h.ctx(c)) {
		var b bookingLite
		if err := cur.Decode(&b); err == nil {
			occ[b.BayID.Hex()] = b
		}
	}
	return c.JSON(fiber.Map{"occupancy": occ, "at": at})
}
