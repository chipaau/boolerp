// Package seeds holds the reference module's seed files (C50, C135). Its data is
// production's starting data: cmd/deploy runs these seeders in every environment,
// after applying the migrations, as the migration role that owns the tables.
package seeds

import (
	"context"
	_ "embed"
	"fmt"
	"regexp"
	"strings"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

//go:embed countries.csv
var countriesCSV []byte

// Country is one row of countries.csv.
type Country struct {
	Code, Alpha3, Name, PhonePrefix string
}

// The same rules as the table's CHECK constraints, so a bad row fails before the
// database sees it.
var (
	codePattern   = regexp.MustCompile(`^[A-Z]{2}$`)
	alpha3Pattern = regexp.MustCompile(`^[A-Z]{3}$`)
	prefixPattern = regexp.MustCompile(`^\+[0-9]{1,4}$`)
)

// ParseCountries reads countries CSV (lines starting with # are comments): a
// header, then one country per line. It rejects a malformed or duplicated row.
func ParseCountries(data []byte) ([]Country, error) {
	records, err := readCSV("countries", data, "code", "alpha3", "name", "phone_prefix")
	if err != nil {
		return nil, err
	}
	var countries []Country
	codes, alpha3s := map[string]bool{}, map[string]bool{}
	for _, rec := range records {
		c := Country{Code: rec[0], Alpha3: rec[1], Name: rec[2], PhonePrefix: rec[3]}
		switch {
		case !codePattern.MatchString(c.Code):
			return nil, fmt.Errorf("countries: code %q is not ISO alpha-2", c.Code)
		case !alpha3Pattern.MatchString(c.Alpha3):
			return nil, fmt.Errorf("countries %s: alpha3 %q is not ISO alpha-3", c.Code, c.Alpha3)
		case strings.TrimSpace(c.Name) == "":
			return nil, fmt.Errorf("countries %s: blank name", c.Code)
		case !prefixPattern.MatchString(c.PhonePrefix):
			return nil, fmt.Errorf("countries %s: phone prefix %q", c.Code, c.PhonePrefix)
		case codes[c.Code]:
			return nil, fmt.Errorf("countries: duplicate code %s", c.Code)
		case alpha3s[c.Alpha3]:
			return nil, fmt.Errorf("countries: duplicate alpha3 %s", c.Alpha3)
		}
		codes[c.Code], alpha3s[c.Alpha3] = true, true
		countries = append(countries, c)
	}
	return countries, nil
}

// Countries seeds the ISO 3166-1 list from countries.csv.
type Countries struct {
	db   DB
	data []byte
}

// NewCountries returns the countries seeder over db, with the embedded list.
func NewCountries(db DB) *Countries { return &Countries{db: db, data: countriesCSV} }

// Name implements seed.Seeder.
func (*Countries) Name() string { return "reference.countries" }

// upsert adds a country or updates a changed one, returning a row only when it
// wrote: inserted is true for a new row. Retirement dates are the operators'
// and are never touched, and no row is ever deleted.
const upsert = `
INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ($1, $2, $3, $4)
ON CONFLICT (code) DO UPDATE
   SET alpha3 = EXCLUDED.alpha3, name = EXCLUDED.name, phone_prefix = EXCLUDED.phone_prefix
 WHERE (countries.alpha3, countries.name, countries.phone_prefix)
       IS DISTINCT FROM (EXCLUDED.alpha3, EXCLUDED.name, EXCLUDED.phone_prefix)
RETURNING xmax = 0`

// Run implements seed.Seeder. It writes the whole list in one transaction, so a
// failure leaves the table as it was, and running it again changes nothing.
func (c *Countries) Run(ctx context.Context, env seed.Env) error {
	countries, err := ParseCountries(c.data)
	if err != nil {
		return err
	}
	rows := make([]row, len(countries))
	for i, k := range countries {
		rows[i] = row{key: k.Code, args: []any{k.Code, k.Alpha3, k.Name, k.PhonePrefix}}
	}
	n, err := upsertAll(ctx, c.db, upsert, rows)
	if err != nil {
		return fmt.Errorf("country %w", err)
	}
	env.Logger.InfoContext(ctx, "countries seeded", "inserted", n.inserted, "updated", n.updated, "unchanged", n.unchanged)
	return nil
}
