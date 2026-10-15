package store

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
)

// Tenant is a tenant as the API shows it.
type Tenant struct {
	ID, Code, Name, Status string
}

// CurrentTenant reads the transaction's own tenant (tenant.ReadTx sets it), which
// row-level security lets it see; pgx.ErrNoRows if it cannot.
func CurrentTenant(ctx context.Context, tx pgx.Tx) (Tenant, error) {
	var t Tenant
	err := tx.QueryRow(ctx, `SELECT id::text, code, name, status FROM tenants WHERE id = current_tenant_id()`).
		Scan(&t.ID, &t.Code, &t.Name, &t.Status)
	return t, err
}

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

// NewTenant is a tenant to insert; empty optional fields are stored as null.
type NewTenant struct {
	Name, Slug, Code, Country, LegalFormID, Timezone  string
	ParentID, IdentityNumber, TaxNumber, Email, Phone string
	RegisteredOn                                      *time.Time
}

// InsertTenant inserts a tenant in provisioning (the column's default) and returns its id.
// Row-level security lets only the operator tenant insert one, and never an operator.
func InsertTenant(ctx context.Context, tx pgx.Tx, n NewTenant) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO tenants (name, slug, code, country, legal_form_id, timezone, parent_id,
		                     identity_number, registered_on, tax_number, email, phone)
		VALUES ($1, $2, $3, $4, $5, $6, nullif($7, '')::uuid,
		        nullif($8, ''), $9, nullif($10, ''), nullif($11, ''), nullif($12, ''))
		RETURNING id::text`,
		n.Name, n.Slug, n.Code, n.Country, n.LegalFormID, n.Timezone, n.ParentID,
		n.IdentityNumber, n.RegisteredOn, n.TaxNumber, n.Email, n.Phone).Scan(&id)
	return id, err
}

// InsertInstitutionType gives tenant an institution type, primary or not.
func InsertInstitutionType(ctx context.Context, tx pgx.Tx, tenant, code string, primary bool) error {
	_, err := tx.Exec(ctx, `INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary)
		VALUES ($1, $2, $3)`, tenant, code, primary)
	return err
}

// TurnOnDefaultApps turns on every live default app for tenant (C204), activated by the
// transaction's actor (null outside a person's request).
func TurnOnDefaultApps(ctx context.Context, tx pgx.Tx, tenant string) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO tenant_apps (tenant_id, app_key, activated_by)
		SELECT $1, key, nullif(current_setting('app.actor_user_id', true), '')::uuid
		  FROM apps
		 WHERE is_default AND active_to IS NULL
		 ORDER BY key`, tenant)
	return err
}

// TenantByID reads one tenant as the list shows it.
func TenantByID(ctx context.Context, tx pgx.Tx, id string) (TenantItem, error) {
	var t TenantItem
	err := tx.QueryRow(ctx, `
		SELECT t.id::text, t.slug, t.code, t.name, t.status, t.country, t.parent_id::text, p.name,
		       (SELECT d.host FROM domains d WHERE d.tenant_id = t.id AND d.serves = 'workspace'
		           AND d.is_primary AND d.status = 'active'),
		       t.created_at
		  FROM tenants t
		  LEFT JOIN tenants p ON p.id = t.parent_id
		 WHERE t.id = $1`, id).
		Scan(&t.ID, &t.Slug, &t.Code, &t.Name, &t.Status, &t.Country, &t.ParentID, &t.ParentName,
			&t.WorkspaceHost, &t.CreatedAt)
	return t, err
}

// holderQueries find the tenant holding a unique value, as the tables' unique indexes
// compare it: slug and code exactly; identity and tax numbers within a country, ignoring case.
var holderQueries = map[string]string{
	"slug":            `SELECT name FROM tenants WHERE slug = $1`,
	"code":            `SELECT name FROM tenants WHERE code = $1`,
	"identity_number": `SELECT name FROM tenants WHERE country = $2 AND upper(identity_number) = upper($1)`,
	"tax_number":      `SELECT name FROM tenants WHERE country = $2 AND upper(tax_number) = upper($1)`,
}

// HolderOf returns the name of the tenant holding value in column (slug, code,
// identity_number, or tax_number); ok is false when none does.
func HolderOf(ctx context.Context, tx pgx.Tx, column, value, country string) (name string, ok bool, err error) {
	sql, known := holderQueries[column]
	if !known {
		return "", false, errors.New("store: no unique column " + column)
	}
	args := []any{value}
	if column == "identity_number" || column == "tax_number" {
		args = append(args, country)
	}
	err = tx.QueryRow(ctx, sql, args...).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	return name, err == nil, err
}

// ParentAllowed reports whether id is a tenant a new tenant may sit under: one that
// exists and is neither the operator nor archived.
func ParentAllowed(ctx context.Context, tx pgx.Tx, id string) (bool, error) {
	var ok bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM tenants WHERE id = $1 AND NOT is_operator
		AND status <> 'archived')`, id).Scan(&ok)
	return ok, err
}
