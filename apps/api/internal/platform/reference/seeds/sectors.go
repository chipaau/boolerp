package seeds

import (
	"context"
	_ "embed"
	"fmt"
	"strings"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

//go:embed sectors.csv
var sectorsCSV []byte

// Sector is one row of sectors.csv.
type Sector struct {
	Code, Name string
}

// ParseSectors reads sectors CSV: a header, then one sector per line. It rejects
// a malformed or duplicated row.
func ParseSectors(data []byte) ([]Sector, error) {
	records, err := readCSV("sectors", data, "code", "name")
	if err != nil {
		return nil, err
	}
	var sectors []Sector
	seen := map[string]bool{}
	for _, rec := range records {
		s := Sector{Code: rec[0], Name: rec[1]}
		switch {
		case !codeKey.MatchString(s.Code):
			return nil, fmt.Errorf("sectors: code %q", s.Code)
		case strings.TrimSpace(s.Name) == "":
			return nil, fmt.Errorf("sectors %s: blank name", s.Code)
		case seen[s.Code]:
			return nil, fmt.Errorf("sectors: duplicate %s", s.Code)
		}
		seen[s.Code] = true
		sectors = append(sectors, s)
	}
	return sectors, nil
}

// Sectors seeds the global sector list from sectors.csv.
type Sectors struct {
	db   DB
	data []byte
}

// NewSectors returns the seeder over db, with the embedded list.
func NewSectors(db DB) *Sectors { return &Sectors{db: db, data: sectorsCSV} }

// Name implements seed.Seeder.
func (*Sectors) Name() string { return "reference.sectors" }

// upsertSector adds a sector or renames a changed one (see upsertAll). Retirement
// dates are the operators' and are never touched, and no row is ever deleted.
const upsertSector = `
INSERT INTO sectors (code, name) VALUES ($1, $2)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
 WHERE sectors.name IS DISTINCT FROM EXCLUDED.name
RETURNING xmax = 0`

// Run implements seed.Seeder, in one transaction like Countries.
func (s *Sectors) Run(ctx context.Context, env seed.Env) error {
	sectors, err := ParseSectors(s.data)
	if err != nil {
		return err
	}
	rows := make([]row, len(sectors))
	for i, k := range sectors {
		rows[i] = row{key: k.Code, args: []any{k.Code, k.Name}}
	}
	n, err := upsertAll(ctx, s.db, upsertSector, rows)
	if err != nil {
		return fmt.Errorf("sector %w", err)
	}
	env.Logger.InfoContext(ctx, "sectors seeded", "inserted", n.inserted, "updated", n.updated, "unchanged", n.unchanged)
	return nil
}
