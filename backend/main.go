package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/config"
	"github.com/tss-booking-system/backend/database"
	"github.com/tss-booking-system/backend/handlers"
	"github.com/tss-booking-system/backend/routes"
	"github.com/tss-booking-system/backend/services"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := database.Connect(ctx, cfg); err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer database.Disconnect(context.Background())

	jwtSvc := services.NewJWTService(cfg.JWTSecret, 24*time.Hour)
	tgSvc := services.NewTelegramService(cfg.TelegramToken, cfg.TelegramChat)

	app := fiber.New()
	h := handlers.NewHandler(database.DB, jwtSvc, tgSvc, cfg.Timezone)
	routes.Register(app, h)

	go func() {
		if err := app.Listen(":" + cfg.AppPort); err != nil {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	_ = app.Shutdown()
}
