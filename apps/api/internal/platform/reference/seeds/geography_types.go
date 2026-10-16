package seeds

import (
	"context"
	_ "embed"
	"fmt"
	"strconv"
	"strings"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

//go:embed geography_types.csv
var geographyTypesCSV []byte

// GeographyType is one row of geography_types.csv: a level of a country's addresses
// (C215), such as the Maldives' atoll (1) or island (2).
type GeographyType struct {
	Country, Code, Name string
	Level               int
}

// ParseGeographyTypes reads geography types CSV: a header, then one type per line. It
// rejects a malformed row or a code repeated within a country.
func ParseGeographyTypes(data []byte) ([]GeographyType, error) {
	records, err := seed.ReadCSV("geography types", data, "country", "code", "name", "level")
	if err != nil {
		return nil, err
	}
	var types []GeographyType
	seen := map[string]bool{}
	for _, rec := range records {
		level, err := strconv.Atoi(rec[3])
		t := GeographyType{Country: rec[0], Code: rec[1], Name: rec[2], Level: level}
		key := t.Country + "/" + t.Code
		switch {
		case !codePattern.MatchString(t.Country):
			return nil, fmt.Errorf("geography types: country %q is not ISO alpha-2", t.Country)
		case !codeKey.MatchString(t.Code):
			return nil, fmt.Errorf("geography types %s: code %q", t.Country, t.Code)
		case strings.TrimSpace(t.Name) == "":
			return nil, fmt.Errorf("geography types %s: blank name", key)
		case err != nil || level < 1 || level > 9:
			return nil, fmt.Errorf("geography types %s: level %q is not 1 to 9", key, rec[3])
		case seen[key]:
			return nil, fmt.Errorf("geography types: duplicate %s", key)
		}
		seen[key] = true
		types = append(types, t)
	}
	return types, nil
}

// GeographyTypes seeds every country's address levels from geography_types.csv. It
// runs after Countries, and before Geographies, whose places have these types.
type GeographyTypes struct {
	db   DB
	data []byte
}

// NewGeographyTypes returns the seeder over db, with the embedded list.
func NewGeographyTypes(db DB) *GeographyTypes {
	return &GeographyTypes{db: db, data: geographyTypesCSV}
}

// Name implements seed.Seeder.
func (*GeographyTypes) Name() string { return "reference.geography_types" }

// upsertGeographyType adds a type or updates a changed one (see upsertAll). Retirement
// dates are the operators' and are never touched, and no row is ever deleted. A level
// does not change once the type has places (the table's trigger refuses it).
const upsertGeographyType = `
INSERT INTO geography_types (country, code, name, level)
VALUES ($1, $2, $3, $4)
ON CONFLICT (country, code) DO UPDATE
   SET name = EXCLUDED.name, level = EXCLUDED.level
 WHERE (geography_types.name, geography_types.level) IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.level)
RETURNING xmax = 0`

// Run implements seed.Seeder, in one transaction like Countries.
func (g *GeographyTypes) Run(ctx context.Context, env seed.Env) error {
	types, err := ParseGeographyTypes(g.data)
	if err != nil {
		return err
	}
	rows := make([]row, len(types))
	for i, t := range types {
		rows[i] = row{key: t.Country + "/" + t.Code, args: []any{t.Country, t.Code, t.Name, t.Level}}
	}
	n, err := upsertAll(ctx, g.db, upsertGeographyType, rows)
	if err != nil {
		return fmt.Errorf("geography type %w", err)
	}
	env.Logger.InfoContext(ctx, "geography types seeded", "inserted", n.inserted, "updated", n.updated, "unchanged", n.unchanged)
	return nil
}
