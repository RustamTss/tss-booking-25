package seed

import (
	"bytes"
	"context"
	"encoding/csv"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const companyCollection = "companies"
const vehicleCollection = "vehicles"

// SeedCompaniesAndUnitsFromCSV reads a CSV (Customer,Unit #,VIN,Year,Make / Model)
// and creates companies and vehicles. Unit # is stored as vehicle.nickname; VIN
// is used to deduplicate vehicles.
func SeedCompaniesAndUnitsFromCSV(ctx context.Context, db *mongo.Database, csvPath string, now time.Time) error {
	f, err := os.Open(csvPath)
	if err != nil {
		return err
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true
	return seedCompaniesAndUnits(ctx, db, reader, now)
}

// SeedCompaniesAndUnitsFromBytes does the same but takes CSV bytes directly (embedded).
func SeedCompaniesAndUnitsFromBytes(ctx context.Context, db *mongo.Database, data []byte, now time.Time) error {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true
	return seedCompaniesAndUnits(ctx, db, reader, now)
}

func seedCompaniesAndUnits(ctx context.Context, db *mongo.Database, reader *csv.Reader, now time.Time) error {
	// read header
	header, err := reader.Read()
	if err != nil {
		return err
	}
	// map columns
	col := map[string]int{}
	for i, h := range header {
		col[strings.ToLower(strings.TrimSpace(h))] = i
	}
	get := func(rec []string, key string) string {
		if idx, ok := col[key]; ok && idx < len(rec) {
			return strings.TrimSpace(rec[idx])
		}
		return ""
	}

	// Cache company name -> id
	companyCache := map[string]primitive.ObjectID{}
	// Preload existing companies into cache
	cur, _ := db.Collection(companyCollection).Find(ctx, bson.D{}, options.Find().SetProjection(bson.M{"name": 1}))
	for cur != nil && cur.Next(ctx) {
		var m struct {
			ID   primitive.ObjectID `bson:"_id"`
			Name string             `bson:"name"`
		}
		if err := cur.Decode(&m); err == nil {
			companyCache[strings.ToUpper(strings.TrimSpace(m.Name))] = m.ID
		}
	}
	if cur != nil {
		cur.Close(ctx)
	}

	bulkVehicles := []mongo.WriteModel{}

	for {
		rec, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		if len(rec) == 0 {
			continue
		}
		customer := get(rec, "customer")
		unitNum := get(rec, "unit #")
		vin := get(rec, "vin")
		yearStr := get(rec, "year")
		makeModel := get(rec, "make / model")
		if customer == "" && vin == "" && unitNum == "" {
			continue
		}

		// resolve company
		normName := strings.ToUpper(strings.TrimSpace(customer))
		if normName == "" {
			normName = "UNKNOWN"
		}
		companyID, ok := companyCache[normName]
		if !ok {
			doc := bson.M{
				"name":       customer,
				"contact":    "",
				"phone":      "",
				"created_at": now,
				"updated_at": now,
			}
			res, err := db.Collection(companyCollection).InsertOne(ctx, doc)
			if err == nil {
				if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
					companyID = oid
					companyCache[normName] = oid
				}
			}
		}

		// parse year
		year := 0
		if y, err := strconv.Atoi(strings.TrimSpace(yearStr)); err == nil {
			year = y
		}
		// split make/model
		make := ""
		model := ""
		if mm := strings.TrimSpace(makeModel); mm != "" {
			parts := strings.Fields(mm)
			if len(parts) > 0 {
				if len(parts) == 1 {
					make = parts[0]
				} else {
					make = parts[0]
					model = strings.Join(parts[1:], " ")
				}
			}
		}
		// simple heuristic: if contains "trailer" -> trailer, else truck
		vtype := "truck"
		lc := strings.ToLower(makeModel)
		if strings.Contains(lc, "trailer") {
			vtype = "trailer"
		}

		// upsert by VIN if present, otherwise insert by (company_id, nickname, plate)
		filter := bson.M{}
		if vin != "" {
			filter["vin"] = vin
		} else {
			filter = bson.M{
				"company_id": companyID,
				"nickname":   unitNum,
				"plate":      "",
			}
		}
		update := bson.M{
			"$setOnInsert": bson.M{
				"created_at": now,
			},
			"$set": bson.M{
				"company_id": companyID,
				"type":       vtype,
				"vin":        vin,
				"plate":      unitNum,
				"nickname":   unitNum,
				"make":       make,
				"model":      model,
				"year":       year,
				"updated_at": now,
			},
		}
		bulkVehicles = append(bulkVehicles, mongo.NewUpdateOneModel().SetFilter(filter).SetUpdate(update).SetUpsert(true))
		// execute in batches
		if len(bulkVehicles) >= 500 {
			_, _ = db.Collection(vehicleCollection).BulkWrite(ctx, bulkVehicles)
			bulkVehicles = bulkVehicles[:0]
		}
	}
	if len(bulkVehicles) > 0 {
		_, _ = db.Collection(vehicleCollection).BulkWrite(ctx, bulkVehicles)
	}
	return nil
}
