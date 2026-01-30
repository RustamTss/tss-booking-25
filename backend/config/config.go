package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
)

// Config хранит основные настройки приложения.
type Config struct {
	AppPort       string
	MongoURI      string
	MongoDB       string
	JWTSecret     string
	TelegramToken string
	TelegramChat  string
	Timezone      *time.Location
	SendPulseClientID     string
	SendPulseClientSecret string
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

// Load загружает конфигурацию из .env и переменных окружения.
func Load() (*Config, error) {
	// пробуем прочитать локальные файлы если есть
	_ = godotenv.Load(".env", "env.local")

	appPort := getEnv("APP_PORT", "8090")
	mongoURI := getEnv("MONGO_URI", "mongodb://localhost:27017")
	mongoDB := getEnv("MONGO_DB", "truckshop")
	jwtSecret := getEnv("JWT_SECRET", "dev_secret_change_me")
	chat := os.Getenv("TELEGRAM_CHAT_ID")
	token := os.Getenv("TELEGRAM_TOKEN")
	tzName := getEnv("TZ", "America/New_York")
	spID := os.Getenv("SENDPULSE_CLIENT_ID")
	spSecret := os.Getenv("SENDPULSE_CLIENT_SECRET")

	tz, err := time.LoadLocation(tzName)
	if err != nil {
		return nil, fmt.Errorf("failed to load timezone %s: %w", tzName, err)
	}

	return &Config{
		AppPort:       appPort,
		MongoURI:      mongoURI,
		MongoDB:       mongoDB,
		JWTSecret:     jwtSecret,
		TelegramChat:  chat,
		TelegramToken: token,
		Timezone:      tz,
		SendPulseClientID:     spID,
		SendPulseClientSecret: spSecret,
	}, nil
}
