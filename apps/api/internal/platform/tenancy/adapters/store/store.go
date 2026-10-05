// Package store reads the tenancy module's tables in PostgreSQL: the lookups that
// run before a request's tenant is known (C131, owned by erp_lookup), and the
// tenant itself inside the tenant's transaction.
package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// Querier runs a query: the pool, or a transaction in tests (C79).
type Querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Host is the tenant a host opens and what the host serves (workspace or a portal key, C132).
type Host struct {
	Tenant tenant.Tenant
	Serves string
}

// Lookups are the tenancy lookups a request makes before its transaction.
type Lookups struct {
	db Querier
}

// NewLookups returns the lookups over db, as the runtime role.
func NewLookups(db Querier) *Lookups { return &Lookups{db: db} }

// TenantByHost returns the tenant an active host opens; ok is false for an unknown,
// pending, or revoked host. host must already be normalised (lowercase, no port).
func (l *Lookups) TenantByHost(ctx context.Context, host string) (h Host, ok bool, err error) {
	err = l.db.QueryRow(ctx, `SELECT tenant_id::text, tenant_code, tenant_status, is_operator, serves
		FROM lookup.tenant_by_host($1)`, host).
		Scan(&h.Tenant.ID, &h.Tenant.Code, &h.Tenant.Status, &h.Tenant.IsOperator, &h.Serves)
	if errors.Is(err, pgx.ErrNoRows) {
		return Host{}, false, nil
	}
	return h, err == nil, err
}

// ActiveMembership returns the user's active membership in the tenant; ok is false
// when they have none (invited, disabled, and ended memberships are not access).
func (l *Lookups) ActiveMembership(ctx context.Context, tenantID, userID string) (m tenant.Membership, ok bool, err error) {
	err = l.db.QueryRow(ctx, `SELECT membership_id::text, is_owner
		FROM lookup.active_membership($1, $2)`, tenantID, userID).Scan(&m.ID, &m.IsOwner)
	if errors.Is(err, pgx.ErrNoRows) {
		return tenant.Membership{}, false, nil
	}
	return m, err == nil, err
}

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
