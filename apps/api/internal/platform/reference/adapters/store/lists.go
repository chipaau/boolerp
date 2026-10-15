// Package store reads the reference lists from PostgreSQL. Every user may read them
// (row-level security lets everyone read every row), so the queries run on the pool,
// outside a tenant's transaction.
package store

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
)

// Querier is what the lists need: the pool, or a transaction in tests (C79).
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// current keeps the rows still in use: not retired, or retired only in the future.
func current(alias string) string {
	return "(" + alias + ".active_to IS NULL OR " + alias + ".active_to > now())"
}

// CountryListSpec is what GET /api/v1/countries accepts: every country in one page.
var CountryListSpec = httpinput.ListSpec{
	Sorts: []string{"name", "code"}, DefaultSort: "name", Search: true,
	DefaultPageSize: 300, MaxPageSize: 300,
}

// Country is a country as the list shows it.
type Country struct{ Code, Alpha3, Name, PhonePrefix string }

// ListCountries reads one page of the current countries and how many match. q matches
// the name or either code.
func ListCountries(ctx context.Context, db Querier, l httpinput.List) ([]Country, int, error) {
	q := query{from: "countries c", where: []string{current("c")},
		sorts: map[string]string{"name": "c.name", "code": "c.code"}, key: "c.code"}
	if l.Q != "" {
		p := q.arg("%" + httpinput.Escape(l.Q) + "%")
		q.where = append(q.where, "(c.name ILIKE "+p+" OR c.code ILIKE "+p+" OR c.alpha3 ILIKE "+p+")")
	}
	items := []Country{}
	total, err := q.run(ctx, db, l, "c.code, c.alpha3, c.name, c.phone_prefix", func(rows pgx.Rows, total *int) error {
		var c Country
		if err := rows.Scan(&c.Code, &c.Alpha3, &c.Name, &c.PhonePrefix, total); err != nil {
			return err
		}
		items = append(items, c)
		return nil
	})
	return items, total, err
}

// LegalFormListSpec is what GET /api/v1/legal-forms accepts: a country's forms.
var LegalFormListSpec = httpinput.ListSpec{
	Sorts: []string{"name", "code"}, DefaultSort: "name", Search: true,
	Filters: map[string][]string{"country": nil}, Required: []string{"country"},
}

// LegalForm is a legal form as the list shows it; IdentityDocument is the document
// whose number a tenant of this form gives, or nil when it names none.
type LegalForm struct {
	ID, Code, Name, Category string
	IdentityDocument         *string
}

// ListLegalForms reads one page of a country's current legal forms. q matches the name.
func ListLegalForms(ctx context.Context, db Querier, l httpinput.List) ([]LegalForm, int, error) {
	q := query{from: "legal_forms f", where: []string{current("f")},
		sorts: map[string]string{"name": "f.name", "code": "f.code"}, key: "f.id"}
	q.where = append(q.where, "f.country = "+q.arg(l.Filters["country"]))
	if l.Q != "" {
		q.where = append(q.where, "f.name ILIKE "+q.arg("%"+httpinput.Escape(l.Q)+"%"))
	}
	items := []LegalForm{}
	total, err := q.run(ctx, db, l, "f.id::text, f.code, f.name, f.category, f.identity_document", func(rows pgx.Rows, total *int) error {
		var f LegalForm
		if err := rows.Scan(&f.ID, &f.Code, &f.Name, &f.Category, &f.IdentityDocument, total); err != nil {
			return err
		}
		items = append(items, f)
		return nil
	})
	return items, total, err
}

// InstitutionTypeListSpec is what GET /api/v1/institution-types accepts.
var InstitutionTypeListSpec = httpinput.ListSpec{
	Sorts: []string{"sector", "name", "code"}, DefaultSort: "sector,name", Search: true,
	Filters: map[string][]string{"sector": nil},
}

// InstitutionType is an institution type with its sector, as the list shows it.
type InstitutionType struct{ Code, Name, SectorCode, SectorName string }

// ListInstitutionTypes reads one page of the current institution types of current
// sectors. q matches the type's name.
func ListInstitutionTypes(ctx context.Context, db Querier, l httpinput.List) ([]InstitutionType, int, error) {
	q := query{from: "institution_types i JOIN sectors s ON s.code = i.sector", where: []string{current("i"), current("s")},
		sorts: map[string]string{"sector": "s.name", "name": "i.name", "code": "i.code"}, key: "i.code"}
	if s, ok := l.Filters["sector"]; ok {
		q.where = append(q.where, "i.sector = "+q.arg(s))
	}
	if l.Q != "" {
		q.where = append(q.where, "i.name ILIKE "+q.arg("%"+httpinput.Escape(l.Q)+"%"))
	}
	items := []InstitutionType{}
	total, err := q.run(ctx, db, l, "i.code, i.name, s.code, s.name", func(rows pgx.Rows, total *int) error {
		var it InstitutionType
		if err := rows.Scan(&it.Code, &it.Name, &it.SectorCode, &it.SectorName, total); err != nil {
			return err
		}
		items = append(items, it)
		return nil
	})
	return items, total, err
}

// query builds one list's SQL from its declared parts: only the spec's sort fields and
// filters reach it, and every value is a parameter.
type query struct {
	from  string
	where []string
	sorts map[string]string // sort field → column
	key   string            // a unique column, last in the order, so pages are stable
	args  []any
}

func (q *query) arg(v any) string {
	q.args = append(q.args, v)
	return "$" + strconv.Itoa(len(q.args))
}

// run reads a page with the total of matches (a window count), scanning each row with
// scan; past the last page it counts the matches instead.
func (q *query) run(ctx context.Context, db Querier, l httpinput.List, columns string,
	scan func(rows pgx.Rows, total *int) error) (int, error) {
	order := make([]string, 0, len(l.Sort)+1)
	for _, f := range l.Sort {
		dir := " ASC"
		if f.Desc {
			dir = " DESC"
		}
		order = append(order, q.sorts[f.Field]+dir)
	}
	order = append(order, q.key)
	where := " WHERE " + strings.Join(q.where, " AND ")
	filterArgs := len(q.args)
	sql := "SELECT " + columns + ", count(*) OVER () FROM " + q.from + where +
		" ORDER BY " + strings.Join(order, ", ") + " LIMIT " + q.arg(l.PageSize) + " OFFSET " + q.arg(l.Offset())

	rows, err := db.Query(ctx, sql, q.args...)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	total, n := 0, 0
	for rows.Next() {
		if err := scan(rows, &total); err != nil {
			return 0, err
		}
		n++
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if n == 0 && l.Page > 1 {
		// Past the last page: the window count is unknown, so count the matches.
		if err := db.QueryRow(ctx, "SELECT count(*) FROM "+q.from+where, q.args[:filterArgs]...).Scan(&total); err != nil {
			return 0, err
		}
	}
	return total, nil
}
