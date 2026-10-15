package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// InstitutionTypeListSpec is what GET /api/v1/institution-types accepts.
var InstitutionTypeListSpec = request.ListSpec{
	Sorts: []string{"sector", "name", "code"}, DefaultSort: "sector,name", Search: true,
	Filters: map[string][]string{"sector": nil},
}

// InstitutionType is an institution type with its sector, as the list shows it.
type InstitutionType struct{ Code, Name, SectorCode, SectorName string }

// ListInstitutionTypes reads one page of the current institution types of current
// sectors. q matches the type's name.
func ListInstitutionTypes(ctx context.Context, db Querier, l request.List) ([]InstitutionType, int, error) {
	q := postgres.ListQuery{From: "institution_types i JOIN sectors s ON s.code = i.sector",
		Sorts: map[string]string{"sector": "s.name", "name": "i.name", "code": "i.code"}, Key: "i.code"}
	q.Where(current("i"))
	q.Where(current("s"))
	if s, ok := l.Filters["sector"]; ok {
		q.Equal("i.sector", s)
	}
	q.Search(l.Q, "i.name")
	items := []InstitutionType{}
	total, err := q.Run(ctx, db, l, "i.code, i.name, s.code, s.name", func(rows pgx.Rows, total *int) error {
		var it InstitutionType
		if err := rows.Scan(&it.Code, &it.Name, &it.SectorCode, &it.SectorName, total); err != nil {
			return err
		}
		items = append(items, it)
		return nil
	})
	return items, total, err
}

// InstitutionTypesCurrent returns which of codes are current institution types of
// current sectors.
func InstitutionTypesCurrent(ctx context.Context, db Querier, codes []string) (map[string]bool, error) {
	rows, err := db.Query(ctx, `SELECT i.code FROM institution_types i JOIN sectors s ON s.code = i.sector
		WHERE i.code = ANY ($1) AND `+current("i")+` AND `+current("s"), codes)
	if err != nil {
		return nil, err
	}
	found, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, err
	}
	current := make(map[string]bool, len(found))
	for _, c := range found {
		current[c] = true
	}
	return current, nil
}
