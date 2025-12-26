package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const settingsCollection = "settings"

type telegramSettingsRequest struct {
	TelegramToken string `json:"telegram_token"`
	TelegramChat  string `json:"telegram_chat"`
}

func (h *Handler) GetTelegramSettings(c *fiber.Ctx) error {
	var settings models.Settings
	err := h.DB.Collection(settingsCollection).FindOne(h.ctx(c), bson.M{"_id": "global"}).Decode(&settings)
	if err != nil && err != mongo.ErrNoDocuments {
		return fiber.ErrInternalServerError
	}
	return c.JSON(settings)
}

func (h *Handler) SaveTelegramSettings(c *fiber.Ctx) error {
	var req telegramSettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.ErrBadRequest
	}

	update := bson.M{
		"$set": bson.M{
			"_id":            "global",
			"telegram_token": req.TelegramToken,
			"telegram_chat":  req.TelegramChat,
			"updated_at":     time.Now(),
		},
	}

	_, err := h.DB.Collection(settingsCollection).UpdateByID(h.ctx(c), "global", update, optionsForUpsert())
	if err != nil {
		return fiber.ErrInternalServerError
	}

	// обновляем runtime сервис
	h.Telegram.Update(req.TelegramToken, req.TelegramChat)

	return c.JSON(fiber.Map{"success": true})
}

func optionsForUpsert() *options.UpdateOptions {
	upsert := true
	return &options.UpdateOptions{Upsert: &upsert}
}
