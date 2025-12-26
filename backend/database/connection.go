package database

import (
	"context"
	"fmt"
	"time"

	"github.com/tss-booking-system/backend/config"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	Client *mongo.Client
	DB     *mongo.Database
)

// Connect инициализирует соединение с MongoDB.
func Connect(ctx context.Context, cfg *config.Config) error {
	opts := options.Client().
		ApplyURI(cfg.MongoURI).
		SetServerSelectionTimeout(5 * time.Second)

	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return fmt.Errorf("mongo connect: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("mongo ping: %w", err)
	}

	Client = client
	DB = client.Database(cfg.MongoDB)
	return nil
}

// Disconnect закрывает соединение.
func Disconnect(ctx context.Context) error {
	if Client == nil {
		return nil
	}
	return Client.Disconnect(ctx)
}
