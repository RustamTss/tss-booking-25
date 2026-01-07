package seed

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var bayNames = []string{
	"Bay-1-1",
	"Bay-1-2",
	"IB(1-2)-1",
	"Body-Shop",
	"Bay-2-2",
	"Bay-2-3",
	"IB(2-3)-1",
	"IB(2-3)-2",
	"Alignment-Rack",
	"Bay-3-2",
	"Bay-3-3",
	"IB(3-4)-1",
	"IB(3-4)-2",
	"IB(3-4)-3",
	"Bay-4-1",
	"Bay-4-2",
	"Bay-4-3",
	"Bay-5-1",
	"Bay-5-2",
	"Bay-5-3",
	"OB-1",
	"OB-2",
	"OB-3",
	"OB-4",
	"OB-5",
}

const bayCollection = "bays"

// EnsureBayIndex creates a unique index on bays.key
func EnsureBayIndex(ctx context.Context, db *mongo.Database) error {
	_, err := db.Collection(bayCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "key", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("uniq_bay_key"),
	})
	return err
}

// SeedBaysIfEmpty inserts initial bays if collection has no documents.
func SeedBaysIfEmpty(ctx context.Context, db *mongo.Database, now time.Time) error {
	count, err := db.Collection(bayCollection).CountDocuments(ctx, bson.D{})
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	type bayDoc struct {
		Key       string    `bson:"key"`
		Name      string    `bson:"name"`
		CreatedAt time.Time `bson:"created_at"`
		UpdatedAt time.Time `bson:"updated_at"`
	}
	var docs []interface{}
	for _, n := range bayNames {
		docs = append(docs, bayDoc{
			Key:       n,
			Name:      n,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
	_, err = db.Collection(bayCollection).InsertMany(ctx, docs)
	return err
}
