package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// CountryListSpec is what GET /api/v1/countries accepts: every country in one page.
var CountryListSpec = request.ListSpec{
	Sorts: []string{"name", "code"}, DefaultSort: "name", Search: true,
	DefaultPageSize: 300, MaxPageSize: 300,
}

// Country is a country as the list shows it, with how many current places it lists for
// address pickers (C215).
type Country struct {
	Code, Alpha3, Name, PhonePrefix string
	GeographyCount                  int
}

// ListCountries reads one page of the current countries and how many match. q matches
// the name or either code.
func ListCountries(ctx context.Context, db Querier, l request.List) ([]Country, int, error) {
	q := postgres.ListQuery{From: "countries c", Sorts: map[string]string{"name": "c.name", "code": "c.code"}, Key: "c.code"}
	q.Where(current("c"))
	q.Search(l.Q, "c.name", "c.code", "c.alpha3")
	items := []Country{}
	columns := `c.code, c.alpha3, c.name, c.phone_prefix,
		(SELECT count(*) FROM geographies g WHERE g.country = c.code AND ` + current("g") + `)::int`
	total, err := q.Run(ctx, db, l, columns, func(rows pgx.Rows, total *int) error {
		var c Country
		if err := rows.Scan(&c.Code, &c.Alpha3, &c.Name, &c.PhonePrefix, &c.GeographyCount, total); err != nil {
			return err
		}
		items = append(items, c)
		return nil
	})
	return items, total, err
}

// CountryCurrent reports whether code is a country in use.
func CountryCurrent(ctx context.Context, db Querier, code string) (bool, error) {
	var ok bool
	err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM countries c WHERE c.code = $1 AND `+current("c")+`)`, code).Scan(&ok)
	return ok, err
}
