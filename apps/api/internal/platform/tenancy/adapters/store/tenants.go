package store

import (
	"context"

	"github.com/jackc/pgx/v5"
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
