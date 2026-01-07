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
	"github.com/tss-booking-system/backend/models"
	"github.com/tss-booking-system/backend/routes"
	"github.com/tss-booking-system/backend/seed"
	"github.com/tss-booking-system/backend/services"
	"go.mongodb.org/mongo-driver/bson"
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

	// Ensure indexes and initial seeds
	if err := seed.EnsureBayIndex(context.Background(), database.DB); err != nil {
		log.Printf("ensure bay index: %v", err)
	}
	if err := seed.SeedBaysIfEmpty(context.Background(), database.DB, time.Now().In(cfg.Timezone)); err != nil {
		log.Printf("seed bays: %v", err)
	}
	// Seed companies and units from CSV if present
	{
		const csvPath = "backend/seed/Fleet Report 01-06-2026.csv"
		// Prefer embedded CSV if available at build time
		if len(seed.FleetReportCSV) > 0 {
			if err := seed.SeedCompaniesAndUnitsFromBytes(context.Background(), database.DB, seed.FleetReportCSV, time.Now().In(cfg.Timezone)); err != nil {
				log.Printf("seed companies/units (embedded): %v", err)
			}
		} else if _, err := os.Stat(csvPath); err == nil {
			if err := seed.SeedCompaniesAndUnitsFromCSV(context.Background(), database.DB, csvPath, time.Now().In(cfg.Timezone)); err != nil {
				log.Printf("seed companies/units: %v", err)
			}
		} else {
			log.Printf("seed csv not found: %s (skipping)", csvPath)
		}
	}

	jwtSvc := services.NewJWTService(cfg.JWTSecret, 24*time.Hour)
	tgSvc := services.NewTelegramService(cfg.TelegramToken, cfg.TelegramChat)
	// Load persisted settings at startup so Telegram works without re-saving
	{
		var s models.Settings
		if err := database.DB.Collection("settings").FindOne(ctx, bson.M{"_id": "global"}).Decode(&s); err == nil {
			if s.TelegramToken != "" || s.TelegramChat != "" {
				tgSvc.Update(s.TelegramToken, s.TelegramChat)
			}
		}
	}

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
