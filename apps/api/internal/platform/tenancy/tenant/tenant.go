// Package tenant carries the current tenant in a context.Context and opens
// database transactions for it (C144, C145). Modules import it directly: it
// depends only on pgx, never on the tenancy module's tables or HTTP code.
//
// The tenant is put in ctx by tenancy's ResolveTenant middleware (HTTP), by a
// command's --tenant flag (CLI), or from a job's stored tenant (workers); Tx and
// ReadTx then apply it to every transaction with SET LOCAL, which row-level
// security reads. Nothing is global, so concurrent requests cannot share a tenant.
package tenant

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// Tenant is the tenant a request, command, or job acts in.
type Tenant struct {
	ID     string // tenants.id
	Code   string // tenants.code, for logs and messages
	Status string // tenants.status when it was resolved
}

type (
	tenantKey struct{}
	insideKey struct{}
)

// With returns a copy of ctx that carries t.
func With(ctx context.Context, t Tenant) context.Context {
	return context.WithValue(ctx, tenantKey{}, t)
}

// From returns the tenant ctx carries, if any.
func From(ctx context.Context) (Tenant, bool) {
	t, ok := ctx.Value(tenantKey{}).(Tenant)
	return t, ok && t.ID != ""
}

// ErrNoTenant is returned by Tx and ReadTx when ctx carries no tenant.
var ErrNoTenant = errors.New("tenant: no tenant in context")

// ErrNested is returned by Tx and ReadTx when ctx is already inside a tenant
// transaction: one operation is one transaction with one tenant (C116). A nested
// call would either share the outer transaction silently or open a second
// connection, possibly for another tenant.
var ErrNested = errors.New("tenant: already inside a tenant transaction")

// Beginner begins transactions: a *pgxpool.Pool, or a *pgxpool.Conn in tests.
type Beginner interface {
	BeginTx(ctx context.Context, txOptions pgx.TxOptions) (pgx.Tx, error)
}

// Tx runs fn in a read-write transaction for the tenant in ctx: it commits when
// fn returns nil and rolls back on an error or a panic (pgx.BeginTxFunc). fn's
// ctx is marked as inside, so a nested Tx or ReadTx is refused.
func Tx(ctx context.Context, db Beginner, fn func(ctx context.Context, tx pgx.Tx) error) error {
	return run(ctx, db, pgx.TxOptions{}, fn)
}

// ReadTx is Tx for reads only: the transaction is READ ONLY, so PostgreSQL
// refuses any write in it.
func ReadTx(ctx context.Context, db Beginner, fn func(ctx context.Context, tx pgx.Tx) error) error {
	return run(ctx, db, pgx.TxOptions{AccessMode: pgx.ReadOnly}, fn)
}

func run(ctx context.Context, db Beginner, opts pgx.TxOptions, fn func(ctx context.Context, tx pgx.Tx) error) error {
	t, ok := From(ctx)
	if !ok {
		return ErrNoTenant
	}
	if ctx.Value(insideKey{}) != nil {
		return ErrNested
	}
	inner := context.WithValue(ctx, insideKey{}, true)
	return pgx.BeginTxFunc(ctx, db, opts, func(tx pgx.Tx) error {
		// is_local = true: the setting ends with the transaction, so nothing
		// survives on the pooled connection (C115).
		if _, err := tx.Exec(ctx, `SELECT set_config('app.tenant_id', $1, true)`, t.ID); err != nil {
			return err
		}
		return fn(inner, tx)
	})
}
