package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
	"github.com/tss-booking-system/backend/services"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const settingsCollection = "settings"

type telegramSettingsRequest struct {
	TelegramToken    string `json:"telegram_token"`
	TelegramChat     string `json:"telegram_chat"`
	TelegramTemplate string `json:"telegram_template"`
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
			"_id":               "global",
			"telegram_token":    req.TelegramToken,
			"telegram_chat":     req.TelegramChat,
			"telegram_template": req.TelegramTemplate,
			"updated_at":        time.Now(),
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

// PreviewTelegramTemplate renders the stored template for a given booking_id.
func (h *Handler) PreviewTelegramTemplate(c *fiber.Ctx) error {
	bookingID := c.Query("booking_id")
	if bookingID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "booking_id is required")
	}
	id, err := primitive.ObjectIDFromHex(bookingID)
	if err != nil {
		return fiber.ErrBadRequest
	}

	// Load settings
	var settings models.Settings
	_ = h.DB.Collection(settingsCollection).FindOne(h.ctx(c), bson.M{"_id": "global"}).Decode(&settings)
	tpl := settings.TelegramTemplate
	if tpl == "" {
		tpl = "Booking {booking_id}: {title}\nUnit: {unit}\nBay: {bay_name}\nStart: {start}\nStatus: {status}"
	}

	// Load booking
	var booking models.Booking
	if err := h.DB.Collection(bookingCollection).FindOne(h.ctx(c), bson.M{"_id": id}).Decode(&booking); err != nil {
		if err == mongo.ErrNoDocuments {
			return fiber.ErrNotFound
		}
		return fiber.ErrInternalServerError
	}

	data := make(map[string]string)
	data["booking_id"] = booking.ID.Hex()
	data["title"] = booking.Title
	data["description"] = booking.Description
	data["status"] = string(booking.Status)
	// Default placeholders are pretty (match UI DateTime picker), also provide ISO
	const pretty = "01/02/2006, 03:04 PM"
	data["start"] = booking.Start.In(h.TZ).Format(pretty)
	data["start_pretty"] = data["start"]
	data["start_iso"] = booking.Start.In(h.TZ).Format(time.RFC3339)
	if booking.End != nil {
		data["end"] = booking.End.In(h.TZ).Format(pretty)
		data["end_pretty"] = data["end"]
		data["end_iso"] = booking.End.In(h.TZ).Format(time.RFC3339)
	} else {
		data["end"] = ""
		data["end_pretty"] = ""
		data["end_iso"] = ""
	}

	// Vehicle -> unit
	var vehicle models.Vehicle
	if err := h.DB.Collection(vehicleCollection).FindOne(h.ctx(c), bson.M{"_id": booking.VehicleID}).Decode(&vehicle); err == nil {
		data["vehicle_plate"] = vehicle.Plate
		data["vehicle_vin"] = vehicle.VIN
		data["vehicle_make"] = vehicle.Make
		data["vehicle_model"] = vehicle.Model
		unit := vehicle.Plate
		if unit == "" {
			unit = vehicle.VIN
		}
		data["unit"] = unit
	} else {
		data["unit"] = ""
	}

	// Bay
	var bay models.Bay
	if err := h.DB.Collection(bayCollection).FindOne(h.ctx(c), bson.M{"_id": booking.BayID}).Decode(&bay); err == nil {
		data["bay_name"] = bay.Name
	}
	// Company
	var company models.Company
	if err := h.DB.Collection(companyCollection).FindOne(h.ctx(c), bson.M{"_id": booking.CompanyID}).Decode(&company); err == nil {
		data["company_name"] = company.Name
	}
	// Fullbay service id
	if booking.FullbayServiceID != "" {
		data["fullbay_service_id"] = booking.FullbayServiceID
	}
	// Technicians
	if len(booking.TechnicianIDs) > 0 {
		cur, _ := h.DB.Collection(technicianCollection).Find(h.ctx(c), bson.M{"_id": bson.M{"$in": booking.TechnicianIDs}})
		defer cur.Close(h.ctx(c))
		names := []string{}
		for cur.Next(h.ctx(c)) {
			var t models.Technician
			if err := cur.Decode(&t); err == nil {
				names = append(names, t.Name)
			}
		}
		data["technician_names"] = strings.Join(names, ", ")
	}

	msg := services.Render(tpl, data)
	return c.JSON(fiber.Map{"message": msg, "data": data})
}
