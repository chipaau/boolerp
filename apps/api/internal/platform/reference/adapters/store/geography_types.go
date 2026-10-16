package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// GeographyTypeListSpec is what GET /api/v1/geography-types accepts: a country's address
// levels (C215), all in one page.
var GeographyTypeListSpec = request.ListSpec{
	Sorts: []string{"level", "name"}, DefaultSort: "level",
	Filters: map[string][]string{"country": nil}, Required: []string{"country"},
	DefaultPageSize: 100, MaxPageSize: 100,
}

// GeographyType is an address level as the list shows it.
type GeographyType struct {
	ID, Code, Name string
	Level          int
}

// ListGeographyTypes reads one page of a country's current address levels.
func ListGeographyTypes(ctx context.Context, db Querier, l request.List) ([]GeographyType, int, error) {
	q := postgres.ListQuery{From: "geography_types t", Key: "t.code",
		Sorts: map[string]string{"level": "t.level", "name": "t.name"}}
	q.Where(current("t"))
	q.Equal("t.country", l.Filters["country"])
	items := []GeographyType{}
	total, err := q.Run(ctx, db, l, "t.id::text, t.code, t.name, t.level", func(rows pgx.Rows, total *int) error {
		var g GeographyType
		if err := rows.Scan(&g.ID, &g.Code, &g.Name, &g.Level, total); err != nil {
			return err
		}
		items = append(items, g)
		return nil
	})
	return items, total, err
}

// AddressLevels are what checking an address needs of its country's levels (C215): each
// current type's level and name by code, and the levels that have current places listed.
type AddressLevels struct {
	Types  map[string]GeographyType // by code
	Listed map[int]bool             // levels with places listed
}

// CountryAddressLevels reads country's current address levels and which of them list places.
func CountryAddressLevels(ctx context.Context, db Querier, country string) (AddressLevels, error) {
	a := AddressLevels{Types: map[string]GeographyType{}, Listed: map[int]bool{}}
	rows, err := db.Query(ctx, `
		SELECT t.id::text, t.code, t.name, t.level,
		       EXISTS (SELECT 1 FROM geographies g WHERE g.type_id = t.id AND `+current("g")+`)
		  FROM geography_types t
		 WHERE t.country = $1 AND `+current("t"), country)
	if err != nil {
		return a, err
	}
	defer rows.Close()
	for rows.Next() {
		var g GeographyType
		var listed bool
		if err := rows.Scan(&g.ID, &g.Code, &g.Name, &g.Level, &listed); err != nil {
			return a, err
		}
		a.Types[g.Code] = g
		if listed {
			a.Listed[g.Level] = true
		}
	}
	return a, rows.Err()
}
