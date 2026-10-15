package postgres

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// Querier runs queries: a pool, or a transaction (tenant.ReadTx's, or a test's).
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ListQuery reads one page of a list (C68, C69) from its declared parts: only the spec's
// sort fields and filters reach it, and every value is a parameter. It is the one list
// query every module's store builds on.
//
//	q := postgres.ListQuery{From: "countries c", Sorts: map[string]string{"name": "c.name"}, Key: "c.code"}
//	q.Where("is_current(c.active_from, c.active_to)")
//	q.Search(l.Q, "c.name", "c.code")
//	total, err := q.Run(ctx, db, l, "c.code, c.name", func(rows pgx.Rows, total *int) error { … })
type ListQuery struct {
	From  string            // the FROM clause: a table with its alias, and any joins
	Sorts map[string]string // sort field → column
	Key   string            // a unique column, last in the order, so pages are stable
	where []string
	args  []any
}

// Arg adds v as a parameter and returns its placeholder ($n).
func (q *ListQuery) Arg(v any) string {
	q.args = append(q.args, v)
	return "$" + strconv.Itoa(len(q.args))
}

// Where adds a condition; its values come from Arg.
func (q *ListQuery) Where(condition string) {
	q.where = append(q.where, condition)
}

// Equal adds column = v.
func (q *ListQuery) Equal(column string, v any) {
	q.Where(column + " = " + q.Arg(v))
}

// Search adds a match of term anywhere in any of columns, ignoring case, with LIKE's
// wildcards in term taken literally; an empty term adds nothing.
func (q *ListQuery) Search(term string, columns ...string) {
	if term == "" || len(columns) == 0 {
		return
	}
	p := q.Arg("%" + request.Escape(term) + "%")
	matches := make([]string, len(columns))
	for i, c := range columns {
		matches[i] = c + " ILIKE " + p
	}
	q.Where("(" + strings.Join(matches, " OR ") + ")")
}

// Run reads l's page of columns, scanning each row with scan, which also scans the total
// of matches (a window count) as the last column; past the last page it counts the
// matches instead. It returns that total.
func (q *ListQuery) Run(ctx context.Context, db Querier, l request.List, columns string,
	scan func(rows pgx.Rows, total *int) error) (int, error) {
	order := make([]string, 0, len(l.Sort)+1)
	for _, f := range l.Sort {
		dir := " ASC"
		if f.Desc {
			dir = " DESC"
		}
		order = append(order, q.Sorts[f.Field]+dir)
	}
	order = append(order, q.Key)
	where := ""
	if len(q.where) > 0 {
		where = " WHERE " + strings.Join(q.where, " AND ")
	}
	filters := append([]any(nil), q.args...) // the conditions' values, before the paging's
	sql := "SELECT " + columns + ", count(*) OVER () FROM " + q.From + where +
		" ORDER BY " + strings.Join(order, ", ") + " LIMIT " + q.Arg(l.PageSize) + " OFFSET " + q.Arg(l.Offset())

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
		if err := db.QueryRow(ctx, "SELECT count(*) FROM "+q.From+where, filters...).Scan(&total); err != nil {
			return 0, err
		}
	}
	return total, nil
}
