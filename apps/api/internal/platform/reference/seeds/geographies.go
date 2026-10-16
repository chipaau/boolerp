package seeds

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

//go:embed geographies.csv
var geographiesCSV []byte

// Geography is one row of geographies.csv: a place addresses pick from (C215). Parent
// is the key of its parent (see Key), empty at level 1; Code is its ISO 3166-2 code,
// empty when it has none; ShortName is empty when it has none. Latitude and Longitude
// are its point, both empty when none is known.
type Geography struct {
	Country, Type, Parent, Code, Name, ShortName string
	Latitude, Longitude                          string
}

// Key names the place in the file: its code; for a place without one, its parent's key
// and its name (MV-MLE/Malé), or at level 1 its country and its name (MV/Seenu), so a
// child can name a parent that has no code.
func (g Geography) Key() string {
	switch {
	case g.Code != "":
		return g.Code
	case g.Parent == "":
		return g.Country + "/" + g.Name
	}
	return g.Parent + "/" + g.Name
}

// degrees reports whether s is a decimal number of degrees within ±limit, with at most
// six decimals (the columns' scale).
func degrees(s string, limit float64) bool {
	if !coordinate.MatchString(s) {
		return false
	}
	v, err := strconv.ParseFloat(s, 64)
	return err == nil && v >= -limit && v <= limit
}

var coordinate = regexp.MustCompile(`^-?[0-9]{1,3}(\.[0-9]{1,6})?$`)

// isoSubdivision is the form of an ISO 3166-2 code: the country, a hyphen, and one to
// three letters or digits (MV-26, MV-MLE, US-CA).
var isoSubdivision = regexp.MustCompile(`^[A-Z]{2}-[A-Z0-9]{1,3}$`)

// ParseGeographies reads geographies CSV: a header, then one place per line, each
// after its parent. It rejects a malformed row, a code of another country, a parent
// not yet listed or of another country, and a key listed twice.
func ParseGeographies(data []byte) ([]Geography, error) {
	records, err := seed.ReadCSV("geographies", data, "country", "type", "parent", "code", "name", "short_name",
		"latitude", "longitude")
	if err != nil {
		return nil, err
	}
	var places []Geography
	countryOf := map[string]string{}
	for _, rec := range records {
		g := Geography{Country: rec[0], Type: rec[1], Parent: rec[2], Code: rec[3], Name: rec[4], ShortName: rec[5],
			Latitude: rec[6], Longitude: rec[7]}
		key := g.Key()
		switch {
		case !codePattern.MatchString(g.Country):
			return nil, fmt.Errorf("geographies: country %q is not ISO alpha-2", g.Country)
		case !codeKey.MatchString(g.Type):
			return nil, fmt.Errorf("geographies %s: type %q", key, g.Type)
		case g.Code != "" && (!isoSubdivision.MatchString(g.Code) || !strings.HasPrefix(g.Code, g.Country+"-")):
			return nil, fmt.Errorf("geographies %s: code %q is not an ISO 3166-2 code of %s", key, g.Code, g.Country)
		case strings.TrimSpace(g.Name) == "":
			return nil, fmt.Errorf("geographies %s: blank name", key)
		case g.ShortName != "" && strings.TrimSpace(g.ShortName) == "":
			return nil, fmt.Errorf("geographies %s: blank short name", key)
		case (g.Latitude == "") != (g.Longitude == ""):
			return nil, fmt.Errorf("geographies %s: a latitude needs a longitude, and the reverse", key)
		case g.Latitude != "" && (!degrees(g.Latitude, 90) || !degrees(g.Longitude, 180)):
			return nil, fmt.Errorf("geographies %s: coordinates %s, %s", key, g.Latitude, g.Longitude)
		case g.Parent != "" && countryOf[g.Parent] == "":
			return nil, fmt.Errorf("geographies %s: parent %q is not listed before it", key, g.Parent)
		case g.Parent != "" && countryOf[g.Parent] != g.Country:
			return nil, fmt.Errorf("geographies %s: parent %q is in another country", key, g.Parent)
		case countryOf[key] != "":
			return nil, fmt.Errorf("geographies: duplicate %s", key)
		}
		countryOf[key] = g.Country
		places = append(places, g)
	}
	return places, nil
}

// Geographies seeds the places from geographies.csv. It runs after GeographyTypes,
// whose types the places have.
type Geographies struct {
	db   DB
	data []byte
}

// NewGeographies returns the seeder over db, with the embedded list.
func NewGeographies(db DB) *Geographies { return &Geographies{db: db, data: geographiesCSV} }

// Name implements seed.Seeder.
func (*Geographies) Name() string { return "reference.geographies" }

// A place with a code is found by it, so its name, type, parent, short name, or point
// may change; a place without one by its siblings' key, so only its short name and
// point may. Both
// add the place or update a changed one, returning its id and whether it is new, and
// return nothing when it is unchanged. Retirement dates and translations are the
// operators' and are never touched, and no row is ever deleted.
const (
	upsertCodedGeography = `
INSERT INTO geographies (country, type_id, parent_id, code, name, short_name, latitude, longitude)
VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, '')::numeric, NULLIF($8, '')::numeric)
ON CONFLICT (country, code) DO UPDATE
   SET type_id = EXCLUDED.type_id, parent_id = EXCLUDED.parent_id, name = EXCLUDED.name,
       short_name = EXCLUDED.short_name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
 WHERE (geographies.type_id, geographies.parent_id, geographies.name, geographies.short_name,
        geographies.latitude, geographies.longitude)
       IS DISTINCT FROM (EXCLUDED.type_id, EXCLUDED.parent_id, EXCLUDED.name, EXCLUDED.short_name,
                         EXCLUDED.latitude, EXCLUDED.longitude)
RETURNING id::text, xmax = 0`
	upsertUncodedGeography = `
INSERT INTO geographies (country, type_id, parent_id, name, short_name, latitude, longitude)
VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, '')::numeric, NULLIF($7, '')::numeric)
ON CONFLICT (country, parent_id, type_id, lower(name)) DO UPDATE
   SET short_name = EXCLUDED.short_name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
 WHERE (geographies.short_name, geographies.latitude, geographies.longitude)
       IS DISTINCT FROM (EXCLUDED.short_name, EXCLUDED.latitude, EXCLUDED.longitude)
RETURNING id::text, xmax = 0`
	codedGeographyID   = `SELECT id::text FROM geographies WHERE country = $1 AND code = $2`
	uncodedGeographyID = `
SELECT id::text FROM geographies
 WHERE country = $1 AND parent_id IS NOT DISTINCT FROM $2 AND type_id = $3 AND lower(name) = lower($4)`
)

// Run implements seed.Seeder, in one transaction like Countries: a failure leaves the
// places as they were.
func (g *Geographies) Run(ctx context.Context, env seed.Env) error {
	places, err := ParseGeographies(g.data)
	if err != nil {
		return err
	}
	var n counts
	err = actor.Tx(ctx, g.db, func(ctx context.Context, tx pgx.Tx) error {
		typeIDs, err := geographyTypeIDs(ctx, tx)
		if err != nil {
			return err
		}
		ids := make(map[string]string, len(places))
		for _, p := range places {
			typeID, ok := typeIDs[p.Country+"/"+p.Type]
			if !ok {
				return fmt.Errorf("geography %s: no type %s/%s", p.Key(), p.Country, p.Type)
			}
			var parentID *string
			if p.Parent != "" {
				id := ids[p.Parent]
				parentID = &id
			}
			var id string
			var isNew bool
			if p.Code != "" {
				err = tx.QueryRow(ctx, upsertCodedGeography, p.Country, typeID, parentID, p.Code, p.Name, p.ShortName,
					p.Latitude, p.Longitude).Scan(&id, &isNew)
			} else {
				err = tx.QueryRow(ctx, upsertUncodedGeography, p.Country, typeID, parentID, p.Name, p.ShortName,
					p.Latitude, p.Longitude).Scan(&id, &isNew)
			}
			switch {
			case errors.Is(err, pgx.ErrNoRows):
				n.unchanged++
				if p.Code != "" {
					err = tx.QueryRow(ctx, codedGeographyID, p.Country, p.Code).Scan(&id)
				} else {
					err = tx.QueryRow(ctx, uncodedGeographyID, p.Country, parentID, typeID, p.Name).Scan(&id)
				}
				if err != nil {
					return fmt.Errorf("geography %s: %w", p.Key(), err)
				}
			case err != nil:
				return fmt.Errorf("geography %s: %w", p.Key(), err)
			case isNew:
				n.inserted++
			default:
				n.updated++
			}
			ids[p.Key()] = id
		}
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "geographies seeded", "inserted", n.inserted, "updated", n.updated, "unchanged", n.unchanged)
	return nil
}

// geographyTypeIDs maps each type's country/code to its id.
func geographyTypeIDs(ctx context.Context, tx pgx.Tx) (map[string]string, error) {
	rows, err := tx.Query(ctx, `SELECT country || '/' || code, id::text FROM geography_types`)
	if err != nil {
		return nil, fmt.Errorf("geography types: %w", err)
	}
	ids := map[string]string{}
	for rows.Next() {
		var key, id string
		if err := rows.Scan(&key, &id); err != nil {
			return nil, fmt.Errorf("geography types: %w", err)
		}
		ids[key] = id
	}
	return ids, rows.Err()
}
