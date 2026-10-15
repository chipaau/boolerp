// Package store reads the reference lists from PostgreSQL. Every user may read them
// (row-level security lets everyone read every row), so the queries run on the pool,
// outside a tenant's transaction.
package store

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
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
func (q *query) run(ctx context.Context, db Querier, l request.List, columns string,
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
