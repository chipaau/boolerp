package store

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
)

// TenantListSpec is what GET /api/v1/tenants accepts (C179).
var TenantListSpec = httpinput.ListSpec{
	Sorts:       []string{"name", "code", "createdAt"},
	DefaultSort: "name",
	Filters:     map[string][]string{"status": {"provisioning", "active", "suspended", "archived"}},
	Search:      true,
}

// sortColumns maps a declared sort field to its column; nothing else reaches SQL.
var sortColumns = map[string]string{"name": "t.name", "code": "t.code", "createdAt": "t.created_at"}

// TenantItem is a tenant as the list shows it (C179).
type TenantItem struct {
	ID, Slug, Code, Name, Status, Country string
	ParentID, ParentName, WorkspaceHost   *string
	CreatedAt                             time.Time
}

// ListTenants reads one page of the tenants the transaction may see (the operator: all)
// and how many match in total. q matches the code, name, or slug.
func ListTenants(ctx context.Context, tx pgx.Tx, l httpinput.List) ([]TenantItem, int, error) {
	var where []string
	args := []any{}
	arg := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if l.Q != "" {
		p := arg("%" + httpinput.Escape(l.Q) + "%")
		where = append(where, "(t.code ILIKE "+p+" OR t.name ILIKE "+p+" OR t.slug ILIKE "+p+")")
	}
	if s, ok := l.Filters["status"]; ok {
		where = append(where, "t.status = "+arg(s))
	}
	order := make([]string, 0, len(l.Sort)+1)
	for _, f := range l.Sort {
		dir := " ASC"
		if f.Desc {
			dir = " DESC"
		}
		order = append(order, sortColumns[f.Field]+dir)
	}
	order = append(order, "t.id") // a stable order across pages

	// p.name, not just t.parent_id: the list shows the parent by name, and a page is a window over
	// the whole table — a tenant's parent is usually on another page, so a name resolved from the
	// rows at hand would be missing precisely when the hierarchy is worth seeing.
	sql := `SELECT t.id::text, t.slug, t.code, t.name, t.status, t.country, t.parent_id::text, p.name,
	               (SELECT d.host FROM domains d WHERE d.tenant_id = t.id AND d.serves = 'workspace'
	                   AND d.is_primary AND d.status = 'active'),
	               t.created_at, count(*) OVER ()
	          FROM tenants t
	          LEFT JOIN tenants p ON p.id = t.parent_id`
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	sql += " ORDER BY " + strings.Join(order, ", ") + " LIMIT " + arg(l.PageSize) + " OFFSET " + arg(l.Offset())

	rows, err := tx.Query(ctx, sql, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []TenantItem{}
	total := 0
	for rows.Next() {
		var t TenantItem
		if err := rows.Scan(&t.ID, &t.Slug, &t.Code, &t.Name, &t.Status, &t.Country, &t.ParentID,
			&t.ParentName, &t.WorkspaceHost, &t.CreatedAt, &total); err != nil {
			return nil, 0, err
		}
		items = append(items, t)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if len(items) == 0 && l.Page > 1 {
		// Past the last page: the window count is unknown, so count the matches.
		cnt := `SELECT count(*) FROM tenants t`
		if len(where) > 0 {
			cnt += " WHERE " + strings.Join(where, " AND ")
		}
		if err := tx.QueryRow(ctx, cnt, args[:len(args)-2]...).Scan(&total); err != nil {
			return nil, 0, err
		}
	}
	return items, total, nil
}
