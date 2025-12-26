package routes

import (
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/tss-booking-system/backend/handlers"
	"github.com/tss-booking-system/backend/models"
)

func Register(app *fiber.App, h *handlers.Handler) {
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Authorization,Content-Type",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
	}))

	app.Get("/health", h.Health)
	app.Post("/auth/login", h.Login)
	app.Post("/auth/users", h.AuthMiddleware(models.RoleAdmin), h.CreateUser)
	app.Get("/auth/users", h.AuthMiddleware(models.RoleAdmin), h.ListUsers)
	app.Post("/debug/seed-admin", h.SeedAdmin)
	app.Get("/ws", h.WSUpgrade, websocket.New(h.WSSocket))

	api := app.Group("/api", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher, models.RoleMechanic, models.RoleClient))

	api.Get("/dashboard/summary", h.DashboardSummary)

	api.Get("/services", h.ListServices)
	api.Post("/services", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.CreateService)
	api.Put("/services/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.UpdateService)
	api.Delete("/services/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteService)

	api.Get("/technicians", h.ListTechnicians)
	api.Post("/technicians", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.CreateTechnician)
	api.Put("/technicians/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.UpdateTechnician)
	api.Delete("/technicians/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteTechnician)

	api.Get("/bays", h.ListBays)
	api.Post("/bays", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.CreateBay)
	api.Put("/bays/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.UpdateBay)
	api.Delete("/bays/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteBay)

	api.Get("/companies", h.ListCompanies)
	api.Post("/companies", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.CreateCompany)
	api.Put("/companies/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.UpdateCompany)
	api.Delete("/companies/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteCompany)

	api.Get("/vehicles", h.ListVehicles)
	api.Post("/vehicles", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.CreateVehicle)
	api.Put("/vehicles/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.UpdateVehicle)
	api.Delete("/vehicles/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteVehicle)

	api.Get("/bookings", h.ListBookings)
	api.Get("/bookings/agenda", h.Agenda)
	api.Post("/bookings", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.CreateBooking)
	api.Put("/bookings/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.UpdateBooking)
	api.Put("/bookings/:id/cancel", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher), h.CancelBooking)
	api.Put("/bookings/:id/close", h.AuthMiddleware(models.RoleAdmin, models.RoleDispatcher, models.RoleMechanic), h.CloseBooking)

	api.Get("/settings/telegram", h.AuthMiddleware(models.RoleAdmin), h.GetTelegramSettings)
	api.Put("/settings/telegram", h.AuthMiddleware(models.RoleAdmin), h.SaveTelegramSettings)
}
