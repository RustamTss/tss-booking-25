package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const companyCollection = "companies"

type companyPostRequest struct {
	Name    string `json:"name"`
	Contact string `json:"contact"`
	Phone   string `json:"phone"`
}

func (h *Handler) ListCompanies(c *fiber.Ctx) error {
	filter := bson.D{}
	if q := c.Query("q"); q != "" {
		filter = append(filter, bson.E{Key: "$or", Value: []bson.M{
			{"name": bson.M{"$regex": q, "$options": "i"}},
			{"contact": bson.M{"$regex": q, "$options": "i"}},
			{"phone": bson.M{"$regex": q, "$options": "i"}},
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
	cur, err := h.DB.Collection(companyCollection).Find(h.ctx(c), filter, opts)
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

// GetCompany returns company by id
func (h *Handler) GetCompany(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var comp models.Company
	if err := h.DB.Collection(companyCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&comp); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(comp)
}

func (h *Handler) CreateCompany(c *fiber.Ctx) error {
	var req companyPostRequest
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
	// Create primary contact record if provided
	if req.Contact != "" || req.Phone != "" {
		_, _ = h.DB.Collection("contacts").InsertOne(h.ctx(c), models.Contact{
			ID:        primitive.NewObjectID(),
			CompanyID: item.ID,
			Name:      req.Contact,
			Phone:     req.Phone,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
	// audit
	var actor primitive.ObjectID
	if uid := getUserID(c); uid != "" {
		if id, err := primitive.ObjectIDFromHex(uid); err == nil {
			actor = id
		}
	}
	_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
		ID:        primitive.NewObjectID(),
		Action:    "company.created",
		Entity:    "company",
		EntityID:  item.ID,
		UserID:    actor,
		Meta:      bson.M{"name": item.Name, "contact": item.Contact, "phone": item.Phone},
		CreatedAt: now,
	})
	return c.Status(fiber.StatusCreated).JSON(item)
}

func (h *Handler) UpdateCompany(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req companyPostRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	// load previous
	var prev models.Company
	_ = h.DB.Collection(companyCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&prev)
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
	changes := bson.M{}
	if prev.Name != req.Name {
		changes["name"] = bson.M{"from": prev.Name, "to": req.Name}
	}
	if prev.Contact != req.Contact {
		changes["contact"] = bson.M{"from": prev.Contact, "to": req.Contact}
	}
	if prev.Phone != req.Phone {
		changes["phone"] = bson.M{"from": prev.Phone, "to": req.Phone}
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
			Action:    "company.updated",
			Entity:    "company",
			EntityID:  id,
			UserID:    actor,
			Meta:      changes,
			CreatedAt: h.now(),
		})
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

func (h *Handler) ListCompanyLogs(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), bson.M{
		"entity":    "company",
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
