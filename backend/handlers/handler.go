package handlers

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"github.com/tss-booking-system/backend/services"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Handler struct {
	DB       *mongo.Database
	JWT      *services.JWTService
	Telegram *services.TelegramService
	TZ       *time.Location
}

func NewHandler(db *mongo.Database, jwt *services.JWTService, tg *services.TelegramService, tz *time.Location) *Handler {
	return &Handler{
		DB:       db,
		JWT:      jwt,
		Telegram: tg,
		TZ:       tz,
	}
}

type authContextKey string

const (
	localUserID authContextKey = "userID"
	localRole   authContextKey = "role"
)

func (h *Handler) authMiddleware(allowed ...models.UserRole) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return fiber.ErrUnauthorized
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return fiber.ErrUnauthorized
		}
		claims, err := h.JWT.Parse(parts[1])
		if err != nil {
			return fiber.ErrUnauthorized
		}

		if !roleAllowed(models.UserRole(claims.Role), allowed) {
			return fiber.ErrForbidden
		}

		c.Locals(string(localUserID), claims.UserID)
		c.Locals(string(localRole), claims.Role)
		return c.Next()
	}
}

// AuthMiddleware exported для подключения в роутере.
func (h *Handler) AuthMiddleware(allowed ...models.UserRole) fiber.Handler {
	return h.authMiddleware(allowed...)
}

func roleAllowed(role models.UserRole, allowed []models.UserRole) bool {
	if len(allowed) == 0 {
		return true
	}
	for _, r := range allowed {
		if r == role {
			return true
		}
	}
	return false
}

func (h *Handler) now() time.Time {
	return time.Now().In(h.TZ)
}

func (h *Handler) ctx(c *fiber.Ctx) context.Context {
	return c.UserContext()
}

func asObjectID(str string) (primitive.ObjectID, error) {
	id, err := primitive.ObjectIDFromHex(str)
	if err != nil {
		return primitive.NilObjectID, errors.New("invalid id")
	}
	return id, nil
}

func getUserID(c *fiber.Ctx) string {
	if v, ok := c.Locals(string(localUserID)).(string); ok {
		return v
	}
	return ""
}
