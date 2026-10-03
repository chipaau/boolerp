package seeds

import (
	"context"
	_ "embed"
	"fmt"
	"strings"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

//go:embed institution_types.csv
var institutionTypesCSV []byte

// InstitutionType is one row of institution_types.csv.
type InstitutionType struct {
	Code, Sector, Name string
}

// ParseInstitutionTypes reads institution types CSV: a header, then one type per
// line. It rejects a malformed or duplicated row.
func ParseInstitutionTypes(data []byte) ([]InstitutionType, error) {
	records, err := readCSV("institution types", data, "code", "sector", "name")
	if err != nil {
		return nil, err
	}
	var types []InstitutionType
	seen := map[string]bool{}
	for _, rec := range records {
		it := InstitutionType{Code: rec[0], Sector: rec[1], Name: rec[2]}
		switch {
		case !codeKey.MatchString(it.Code):
			return nil, fmt.Errorf("institution types: code %q", it.Code)
		case !codeKey.MatchString(it.Sector):
			return nil, fmt.Errorf("institution types %s: sector %q", it.Code, it.Sector)
		case strings.TrimSpace(it.Name) == "":
			return nil, fmt.Errorf("institution types %s: blank name", it.Code)
		case seen[it.Code]:
			return nil, fmt.Errorf("institution types: duplicate %s", it.Code)
		}
		seen[it.Code] = true
		types = append(types, it)
	}
	return types, nil
}

// InstitutionTypes seeds the global list from institution_types.csv. It runs
// after Sectors, whose rows the types reference.
type InstitutionTypes struct {
	db   DB
	data []byte
}

// NewInstitutionTypes returns the seeder over db, with the embedded list.
func NewInstitutionTypes(db DB) *InstitutionTypes {
	return &InstitutionTypes{db: db, data: institutionTypesCSV}
}

// Name implements seed.Seeder.
func (*InstitutionTypes) Name() string { return "reference.institution_types" }

// upsertInstitutionType adds a type or updates a changed one (see upsertAll).
// Retirement dates are the operators' and are never touched, and no row is ever
// deleted.
const upsertInstitutionType = `
INSERT INTO institution_types (code, sector, name) VALUES ($1, $2, $3)
ON CONFLICT (code) DO UPDATE SET sector = EXCLUDED.sector, name = EXCLUDED.name
 WHERE (institution_types.sector, institution_types.name)
       IS DISTINCT FROM (EXCLUDED.sector, EXCLUDED.name)
RETURNING xmax = 0`

// Run implements seed.Seeder, in one transaction like Countries.
func (s *InstitutionTypes) Run(ctx context.Context, env seed.Env) error {
	types, err := ParseInstitutionTypes(s.data)
	if err != nil {
		return err
	}
	rows := make([]row, len(types))
	for i, it := range types {
		rows[i] = row{key: it.Code, args: []any{it.Code, it.Sector, it.Name}}
	}
	n, err := upsertAll(ctx, s.db, upsertInstitutionType, rows)
	if err != nil {
		return fmt.Errorf("institution type %w", err)
	}
	env.Logger.InfoContext(ctx, "institution types seeded", "inserted", n.inserted, "updated", n.updated, "unchanged", n.unchanged)
	return nil
}
