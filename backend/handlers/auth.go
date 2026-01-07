package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

const (
	userCollection = "users"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string          `json:"token"`
	Role  models.UserRole `json:"role"`
}

func hashPassword(pw string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func checkPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

// Login возвращает JWT для пользователя.
func (h *Handler) Login(c *fiber.Ctx) error {
	var req loginRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}

	var user models.User
	err := h.DB.Collection(userCollection).FindOne(h.ctx(c), bson.M{"email": req.Email}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return fiber.ErrUnauthorized
	}
	if err != nil {
		return fiber.ErrInternalServerError
	}

	if !checkPassword(user.PasswordHash, req.Password) {
		return fiber.ErrUnauthorized
	}

	token, err := h.JWT.Generate(user.ID.Hex(), user.Role)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	return c.JSON(loginResponse{Token: token, Role: user.Role})
}

type createUserRequest struct {
	Email    string          `json:"email"`
	Password string          `json:"password"`
	Role     models.UserRole `json:"role"`
	Status   string          `json:"status"`
}

type updateUserRequest struct {
	Email    *string          `json:"email"`
	Password string           `json:"password"`
	Role     *models.UserRole `json:"role"`
	Status   *string          `json:"status"`
}

// CreateUser только для админов.
func (h *Handler) CreateUser(c *fiber.Ctx) error {
	var req createUserRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	if req.Email == "" || req.Password == "" {
		return fiber.ErrBadRequest
	}

	pw, err := hashPassword(req.Password)
	if err != nil {
		return fiber.ErrInternalServerError
	}

	now := h.now()
	user := models.User{
		ID:           primitive.NewObjectID(),
		Email:        req.Email,
		PasswordHash: pw,
		Role:         req.Role,
		Status:       req.Status,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	_, err = h.DB.Collection(userCollection).InsertOne(h.ctx(c), user)
	if mongo.IsDuplicateKeyError(err) {
		return fiber.NewError(fiber.StatusConflict, "user exists")
	}
	if err != nil {
		return fiber.ErrInternalServerError
	}
	// audit: user created
	{
		var actor primitive.ObjectID
		if uid := getUserID(c); uid != "" {
			if id, err := primitive.ObjectIDFromHex(uid); err == nil {
				actor = id
			}
		}
		_, _ = h.DB.Collection(auditCollection).InsertOne(h.ctx(c), models.AuditLog{
			ID:        primitive.NewObjectID(),
			Action:    "user.created",
			Entity:    "user",
			EntityID:  user.ID,
			UserID:    actor,
			Meta:      bson.M{"email": user.Email, "role": user.Role, "status": user.Status},
			CreatedAt: now,
		})
	}

	return c.Status(fiber.StatusCreated).JSON(user)
}

func (h *Handler) ListUsers(c *fiber.Ctx) error {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(userCollection).Find(h.ctx(c), bson.D{}, opts)
	if err != nil {
		return fiber.ErrInternalServerError
	}
	defer cur.Close(h.ctx(c))

	var users []models.User
	if err := cur.All(h.ctx(c), &users); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(users)
}

// GetUser returns one user by id
func (h *Handler) GetUser(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var user models.User
	if err := h.DB.Collection(userCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
	}
	return c.JSON(user)
}

// UpdateUser allows admin to change role/status/reset password.
func (h *Handler) UpdateUser(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	var req updateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}
	set := bson.M{"updated_at": h.now()}
	if req.Email != nil && *req.Email != "" {
		set["email"] = *req.Email
	}
	if req.Role != nil {
		set["role"] = *req.Role
	}
	if req.Status != nil {
		set["status"] = *req.Status
	}
	if req.Password != "" {
		pw, err := hashPassword(req.Password)
		if err != nil {
			return fiber.ErrInternalServerError
		}
		set["password_hash"] = pw
	}
	update := bson.M{"$set": set}
	// load prev for diff
	var prev models.User
	_ = h.DB.Collection(userCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&prev)
	res, err := h.DB.Collection(userCollection).UpdateByID(h.ctx(c), id, update)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return fiber.NewError(fiber.StatusConflict, "email already in use")
		}
		return fiber.ErrInternalServerError
	}
	if res.MatchedCount == 0 {
		return fiber.ErrNotFound
	}
	// prepare new for diff
	var current models.User
	_ = h.DB.Collection(userCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&current)
	changes := bson.M{}
	if prev.Email != current.Email {
		changes["email"] = bson.M{"from": prev.Email, "to": current.Email}
	}
	if prev.Role != current.Role {
		changes["role"] = bson.M{"from": prev.Role, "to": current.Role}
	}
	if prev.Status != current.Status {
		changes["status"] = bson.M{"from": prev.Status, "to": current.Status}
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
			Action:    "user.updated",
			Entity:    "user",
			EntityID:  id,
			UserID:    actor,
			Meta:      changes,
			CreatedAt: h.now(),
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// DeleteUser removes user by id.
func (h *Handler) DeleteUser(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	res, err := h.DB.Collection(userCollection).DeleteOne(h.ctx(c), bson.M{"_id": id})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if res.DeletedCount == 0 {
		return fiber.ErrNotFound
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// Me returns current authenticated user info
func (h *Handler) Me(c *fiber.Ctx) error {
	uid := getUserID(c)
	if uid == "" {
		return fiber.ErrUnauthorized
	}
	objID, err := asObjectID(uid)
	if err != nil {
		return fiber.ErrUnauthorized
	}
	var user models.User
	if err := h.DB.Collection(userCollection).FindOne(h.ctx(c), bson.M{"_id": objID}).Decode(&user); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrUnauthorized
		}
		return fiber.ErrInternalServerError
	}
	return c.JSON(user)
}

// ListUserLogs returns audit logs for a user
func (h *Handler) ListUserLogs(c *fiber.Ctx) error {
	id, err := asObjectID(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := h.DB.Collection(auditCollection).Find(h.ctx(c), bson.M{
		"entity":    "user",
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

// SeedAdmin создает временного админа если нет ни одного пользователя.
func (h *Handler) SeedAdmin(c *fiber.Ctx) error {
	count, err := h.DB.Collection(userCollection).CountDocuments(h.ctx(c), bson.D{})
	if err != nil {
		return fiber.ErrInternalServerError
	}
	if count > 0 {
		return c.JSON(fiber.Map{"message": "users already exist"})
	}
	pw, _ := hashPassword("admin123")
	now := h.now()
	admin := models.User{
		ID:           primitive.NewObjectID(),
		Email:        "admin@example.com",
		PasswordHash: pw,
		Role:         models.RoleAdmin,
		Status:       "active",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if _, err := h.DB.Collection(userCollection).InsertOne(h.ctx(c), admin); err != nil {
		return fiber.ErrInternalServerError
	}
	return c.JSON(fiber.Map{"email": admin.Email, "password": "admin123"})
}
