package routes

import (
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/tss-booking-system/backend/handlers"
	"github.com/tss-booking-system/backend/models"
)

func Register(app *fiber.App, h *handlers.Handler) {
	app.Use(logger.New())
	// Register WebSocket endpoint before CORS and allow dev origins
	app.Get("/ws", h.WSUpgrade, websocket.New(
		h.WSSocket,
		websocket.Config{
			HandshakeTimeout: 5 * time.Second,
			Origins: []string{
				"https://bookings.tsstruckservice.com",
				"http://bookings.tsstruckservice.com",
				"http://localhost:5190",
				"http://localhost:5173",
				"http://127.0.0.1:5173",
				"http://localhost:3000",
			},
		},
	))
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "https://bookings.tsstruckservice.com,http://bookings.tsstruckservice.com,http://167.71.168.200,http://localhost:5190,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
		AllowHeaders:     "Authorization,Content-Type",
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowCredentials: true,
	}))

	app.Get("/health", h.Health)
	app.Post("/auth/login", h.Login)
	app.Post("/auth/users", h.AuthMiddleware(models.RoleAdmin), h.CreateUser)
	app.Get("/auth/users", h.AuthMiddleware(models.RoleAdmin), h.ListUsers)
	app.Get("/auth/users/:id", h.AuthMiddleware(models.RoleAdmin), h.GetUser)
	app.Put("/auth/users/:id", h.AuthMiddleware(models.RoleAdmin), h.UpdateUser)
	app.Delete("/auth/users/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteUser)
	app.Get("/auth/users/:id/logs", h.AuthMiddleware(models.RoleAdmin), h.ListUserLogs)
	app.Get("/auth/me", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.Me)
	app.Post("/debug/seed-admin", h.SeedAdmin)

	api := app.Group("/api", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice))

	api.Get("/dashboard/summary", h.DashboardSummary)

	api.Get("/technicians", h.ListTechnicians)
	api.Get("/technicians/:id", h.GetOneTechnician)
	api.Post("/technicians", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.CreateTechnician)
	api.Put("/technicians/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.UpdateTechnician)
	api.Delete("/technicians/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.DeleteTechnician)
	api.Get("/technicians/:id/logs", h.ListTechnicianLogs)

	api.Get("/bays", h.ListBays)
	api.Get("/bays/occupancy", h.ListBayOccupancy)
	api.Get("/bays/:id", h.GetBay)
	// Bays: only Admin can create/edit/delete
	api.Post("/bays", h.AuthMiddleware(models.RoleAdmin), h.CreateBay)
	api.Put("/bays/:id", h.AuthMiddleware(models.RoleAdmin), h.UpdateBay)
	api.Delete("/bays/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteBay)
	api.Get("/bays/:id/logs", h.ListBayLogs)

	api.Get("/companies", h.ListCompanies)
	api.Get("/companies/:id", h.GetCompany)
	api.Post("/companies", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.CreateCompany)
	api.Put("/companies/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.UpdateCompany)
	api.Delete("/companies/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.DeleteCompany)
	api.Get("/companies/:id/logs", h.ListCompanyLogs)
	// company contacts
	api.Get("/companies/:id/contacts", h.ListCompanyContacts)
	api.Post("/companies/:id/contacts", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.CreateCompanyContact)
	api.Put("/contacts/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.UpdateContact)
	api.Delete("/contacts/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.DeleteContact)

	api.Get("/vehicles", h.ListVehicles)
	api.Get("/vehicles/:id", h.GetVehicle)
	api.Post("/vehicles", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.CreateVehicle)
	api.Put("/vehicles/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.UpdateVehicle)
	api.Delete("/vehicles/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.DeleteVehicle)
	api.Get("/vehicles/:id/logs", h.ListVehicleLogs)

	api.Get("/bookings", h.ListBookings)
	api.Get("/bookings/agenda", h.Agenda)
	// Side panels on calendar view
	api.Get("/bookings/ready", h.ReadyBookings)
	api.Get("/bookings/waitinglist", h.WaitingListBookings)
	api.Get("/bookings/:id", h.GetBooking)
	// Bookings: only Admin can delete; others allowed for Office
	api.Post("/bookings", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.CreateBooking)
	api.Put("/bookings/:id", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.UpdateBooking)
	api.Put("/bookings/:id/cancel", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.CancelBooking)
	api.Put("/bookings/:id/close", h.AuthMiddleware(models.RoleAdmin, models.RoleOffice), h.CloseBooking)
	api.Delete("/bookings/:id", h.AuthMiddleware(models.RoleAdmin), h.DeleteBooking)
	api.Get("/bookings/:id/logs", h.ListBookingLogs)

	api.Get("/settings/telegram", h.AuthMiddleware(models.RoleAdmin), h.GetTelegramSettings)
	api.Put("/settings/telegram", h.AuthMiddleware(models.RoleAdmin), h.SaveTelegramSettings)
	api.Get("/settings/telegram/preview", h.AuthMiddleware(models.RoleAdmin), h.PreviewTelegramTemplate)
	// Global logs (admin only)
	api.Get("/logs", h.AuthMiddleware(models.RoleAdmin), h.ListAllLogs)
}
