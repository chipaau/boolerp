package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// GeographyTypeListSpec is what GET /api/v1/geography-types accepts (C215, C220): the address
// levels of one country (the pickers, in one page) or of every country (the admin console's list),
// by country (its name, as the list shows it), then level, then name.
var GeographyTypeListSpec = request.ListSpec{
	Sorts: []string{"country", "level", "name", "code"}, DefaultSort: "country,level,name", Search: true,
	Filters:         map[string][]string{"country": nil},
	DefaultPageSize: 100, MaxPageSize: 100,
}

// GeographyType is an address level as the list shows it, with how many current places of it
// are listed (PlaceCount; none means the level is typed in an address).
type GeographyType struct {
	ID, Country, Code, Name string
	Level, PlaceCount       int
}

// ListGeographyTypes reads one page of the current address levels, of one country when the
// country filter is given. q matches the name or the code.
func ListGeographyTypes(ctx context.Context, db Querier, l request.List) ([]GeographyType, int, error) {
	q := postgres.ListQuery{From: "geography_types t JOIN countries c ON c.code = t.country", Key: "t.id",
		Sorts: map[string]string{"country": "c.name", "level": "t.level", "name": "t.name", "code": "t.code"}}
	q.Where(current("t"))
	if country, ok := l.Filters["country"]; ok {
		q.Equal("t.country", country)
	}
	q.Search(l.Q, "t.name", "t.code")
	columns := `t.id::text, t.country, t.code, t.name, t.level,
		(SELECT count(*) FROM geographies g WHERE g.type_id = t.id AND ` + current("g") + `)::int`
	items := []GeographyType{}
	total, err := q.Run(ctx, db, l, columns, func(rows pgx.Rows, total *int) error {
		var g GeographyType
		if err := rows.Scan(&g.ID, &g.Country, &g.Code, &g.Name, &g.Level, &g.PlaceCount, total); err != nil {
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
