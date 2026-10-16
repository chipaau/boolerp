package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// GeographyListSpec is what GET /api/v1/geographies accepts: a country's places under one
// parent (none: its level 1), in one page for a picker; the largest set (a country's
// first level) is a little over 200.
var GeographyListSpec = request.ListSpec{
	Sorts: []string{"name", "code"}, DefaultSort: "name", Search: true,
	Filters: map[string][]string{"country": nil, "parent": nil}, Required: []string{"country"},
	DefaultPageSize: 300, MaxPageSize: 300,
}

// Geography is a place as the pickers show it: its type and level, and whether it has
// current places under it (the next picker).
type Geography struct {
	ID, Type, TypeName, Name string
	Level                    int
	Code, ShortName          *string
	Latitude, Longitude      *float64
	HasChildren              bool
}

// geographyColumns are a place as the pickers show it, over geographies g and its type t.
var geographyColumns = `g.id::text, t.code, t.name, t.level, g.code, g.name, g.short_name,
	g.latitude::float8, g.longitude::float8,
	EXISTS (SELECT 1 FROM geographies c WHERE c.parent_id = g.id AND ` + current("c") + `)`

func scanGeography(row pgx.Row, g *Geography, extra ...any) error {
	return row.Scan(append([]any{&g.ID, &g.Type, &g.TypeName, &g.Level, &g.Code, &g.Name, &g.ShortName,
		&g.Latitude, &g.Longitude, &g.HasChildren}, extra...)...)
}

// ListGeographies reads one page of the current places of a country under one parent
// (the parent filter, a place's id), or at level 1 when none is given. q matches the
// name, the short name, or the code.
func ListGeographies(ctx context.Context, db Querier, l request.List) ([]Geography, int, error) {
	q := postgres.ListQuery{From: "geographies g JOIN geography_types t ON t.id = g.type_id", Key: "g.id",
		Sorts: map[string]string{"name": "g.name", "code": "g.code"}}
	q.Where(current("g"))
	q.Equal("g.country", l.Filters["country"])
	if parent, ok := l.Filters["parent"]; ok {
		// Compared as text, so a parent that is no uuid matches nothing rather than failing.
		q.Equal("g.parent_id::text", parent)
	} else {
		q.Where("g.parent_id IS NULL")
	}
	q.Search(l.Q, "g.name", "g.short_name", "g.code")
	items := []Geography{}
	total, err := q.Run(ctx, db, l, geographyColumns, func(rows pgx.Rows, total *int) error {
		var g Geography
		if err := scanGeography(rows, &g, total); err != nil {
			return err
		}
		items = append(items, g)
		return nil
	})
	return items, total, err
}

// Place is a place an address names, with what checking the address needs: its country,
// and whether it is current and has current places under it.
type Place struct {
	Geography
	Country  string
	ParentID *string
	Current  bool
}

// PlaceByID reads a place, current or not; ok is false when there is none.
func PlaceByID(ctx context.Context, db Querier, id string) (p Place, ok bool, err error) {
	err = scanGeography(db.QueryRow(ctx, `SELECT `+geographyColumns+`, g.country, g.parent_id::text, `+current("g")+`
		  FROM geographies g JOIN geography_types t ON t.id = g.type_id
		 WHERE g.id::text = $1`, id), &p.Geography, &p.Country, &p.ParentID, &p.Current)
	if errors.Is(err, pgx.ErrNoRows) {
		return Place{}, false, nil
	}
	return p, err == nil, err
}

// PlacePath reads a place and its parents, from level 1 down to it; empty when there is no
// such place.
func PlacePath(ctx context.Context, db Querier, id string) ([]Geography, error) {
	rows, err := db.Query(ctx, `
		WITH RECURSIVE up (id, parent_id, depth) AS (
		    SELECT g.id, g.parent_id, 0 FROM geographies g WHERE g.id::text = $1
		    UNION ALL
		    SELECT g.id, g.parent_id, up.depth + 1 FROM geographies g JOIN up ON g.id = up.parent_id)
		SELECT `+geographyColumns+`
		  FROM up JOIN geographies g ON g.id = up.id JOIN geography_types t ON t.id = g.type_id
		 ORDER BY up.depth DESC`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	path := []Geography{}
	for rows.Next() {
		var g Geography
		if err := scanGeography(rows, &g); err != nil {
			return nil, err
		}
		path = append(path, g)
	}
	return path, rows.Err()
}

// CountryListsPlaces reports whether country has current places at level 1.
func CountryListsPlaces(ctx context.Context, db Querier, country string) (bool, error) {
	var ok bool
	err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM geographies g
		WHERE g.country = $1 AND g.parent_id IS NULL AND `+current("g")+`)`, country).Scan(&ok)
	return ok, err
}
