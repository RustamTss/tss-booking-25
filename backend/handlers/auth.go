package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
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

	return c.Status(fiber.StatusCreated).JSON(user)
}

func (h *Handler) ListUsers(c *fiber.Ctx) error {
	cur, err := h.DB.Collection(userCollection).Find(h.ctx(c), bson.D{})
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
		Email:        "admin@" + uuid.NewString() + ".local",
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
