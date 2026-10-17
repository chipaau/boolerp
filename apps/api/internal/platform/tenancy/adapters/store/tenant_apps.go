package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// TenantAppListSpec is what GET /api/v1/tenants/{id}/apps accepts: the apps the tenant may
// have, the default ones first, then those available before those coming soon, then by name.
var TenantAppListSpec = request.ListSpec{Sorts: []string{"default", "available", "name"}, DefaultSort: "-default,-available,name"}

// TenantApp is an app a tenant may have (C166, C224), and whether it has it on now (since
// ActiveFrom).
type TenantApp struct {
	Key, Name, Kind string
	Description     *string
	IsDefault, On   bool
	IsAvailable     bool // false: coming soon (C225)
	ActiveFrom      *time.Time
}

// tenantAppFrom is the apps with a tenant's live activation of each, if any; tenant is the
// placeholder of the tenant's id.
func tenantAppFrom(tenant string) string {
	return `apps a LEFT JOIN tenant_apps ta
	    ON ta.app_key = a.key AND ta.tenant_id = ` + tenant + `::uuid AND ta.active_to IS NULL`
}

// tenantAppMay is the condition that the app is current and the tenant may have it: an
// operator app only the operator tenant, as tenant_apps_valid allows.
func tenantAppMay(tenant string) string {
	return `is_current(a.active_from, a.active_to) AND (a.kind <> 'operator' OR lookup.is_operator_tenant(` + tenant + `::uuid))`
}

const tenantAppColumns = `a.key, a.name, a.kind, a.description, a.is_default, a.is_available,
	ta.id IS NOT NULL AND is_current(ta.active_from, ta.active_to), ta.active_from`

func scanTenantApp(row pgx.Row, a *TenantApp, extra ...any) error {
	return row.Scan(append([]any{&a.Key, &a.Name, &a.Kind, &a.Description, &a.IsDefault, &a.IsAvailable,
		&a.On, &a.ActiveFrom}, extra...)...)
}

// ListTenantApps reads the apps tenant may have, each with whether it is on, and how many.
func ListTenantApps(ctx context.Context, tx pgx.Tx, tenant string, l request.List) ([]TenantApp, int, error) {
	q := postgres.ListQuery{Key: "a.key", Sorts: map[string]string{"default": "a.is_default", "available": "a.is_available", "name": "a.name"}}
	p := q.Arg(tenant)
	q.From = tenantAppFrom(p)
	q.Where(tenantAppMay(p))
	items := []TenantApp{}
	total, err := q.Run(ctx, tx, l, tenantAppColumns, func(rows pgx.Rows, total *int) error {
		var a TenantApp
		if err := scanTenantApp(rows, &a, total); err != nil {
			return err
		}
		items = append(items, a)
		return nil
	})
	return items, total, err
}

// TenantAppByKey reads one app tenant may have; ok is false when it may have none by key
// (unknown, retired, or an operator app elsewhere).
func TenantAppByKey(ctx context.Context, tx pgx.Tx, tenant, key string) (a TenantApp, ok bool, err error) {
	err = scanTenantApp(tx.QueryRow(ctx, `SELECT `+tenantAppColumns+` FROM `+tenantAppFrom("$1")+`
		WHERE a.key = $2 AND `+tenantAppMay("$1"), tenant, key), &a)
	if errors.Is(err, pgx.ErrNoRows) {
		return TenantApp{}, false, nil
	}
	return a, err == nil, err
}

// TurnOnTenantApp turns key on for tenant, activated by the transaction's actor, and
// reports whether it was off; an app already on is left as it is.
func TurnOnTenantApp(ctx context.Context, tx pgx.Tx, tenant, key string) (bool, error) {
	tag, err := tx.Exec(ctx, `
		INSERT INTO tenant_apps (tenant_id, app_key, activated_by)
		VALUES ($1, $2, nullif(current_setting('app.actor_user_id', true), '')::uuid)
		ON CONFLICT (tenant_id, app_key) WHERE active_to IS NULL DO NOTHING`, tenant, key)
	return tag.RowsAffected() > 0, err
}

// TurnOffTenantApp ends tenant's live activation of key, reporting whether it had one.
func TurnOffTenantApp(ctx context.Context, tx pgx.Tx, tenant, key string) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE tenant_apps SET active_to = greatest(now(), active_from)
		WHERE tenant_id = $1 AND app_key = $2 AND active_to IS NULL`, tenant, key)
	return tag.RowsAffected() > 0, err
}
