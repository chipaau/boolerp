// Package actor carries who is acting, and through which operation, in a
// context.Context, and opens transactions that carry it as the app.* settings the audit
// trigger records (C147, C164). Every entry point sets it: the HTTP middleware for
// requests, seed.Run for seeders, and later CLI commands and jobs. It writes nothing
// itself.
package actor

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/requestid"
)

// Actor is who acts and through what. Empty fields are unknown.
type Actor struct {
	UserID    string // the person's users.id
	ClientID  string // the OAuth client the token was issued to
	Operation string // "GET /api/v1/tenant/", "seed: tenancy.operator", "cli: …", "job: …"
	RequestID string
	IP        string
}

type key struct{}

// With returns a copy of ctx that carries a.
func With(ctx context.Context, a Actor) context.Context {
	return context.WithValue(ctx, key{}, a)
}

// From returns the actor ctx carries; the zero Actor if none.
func From(ctx context.Context) Actor {
	a, _ := ctx.Value(key{}).(Actor)
	return a
}

// Beginner begins a transaction: a pool, or a transaction (a savepoint) in tests.
type Beginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Tx runs fn in a transaction on db for a write outside any tenant (users, seed
// files), with ctx's actor applied first: it commits when fn returns nil and rolls back
// on an error or a panic (pgx.BeginFunc). Writes inside a tenant use tenant.Tx, which
// applies the actor too. These two are the only ways code opens a writing transaction,
// so no write misses its actor (C164).
func Tx(ctx context.Context, db Beginner, fn func(ctx context.Context, tx pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, db, func(tx pgx.Tx) error {
		if err := apply(ctx, tx, ""); err != nil {
			return err
		}
		return fn(ctx, tx)
	})
}

// TxBeginner begins a transaction with options: a pool or a connection.
type TxBeginner interface {
	BeginTx(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error)
}

// TxIn is Tx with transaction options and the tenant the actor acts in, for tenant.Tx.
func TxIn(ctx context.Context, db TxBeginner, opts pgx.TxOptions, actingTenant string, fn func(tx pgx.Tx) error) error {
	return pgx.BeginTxFunc(ctx, db, opts, func(tx pgx.Tx) error {
		if err := apply(ctx, tx, actingTenant); err != nil {
			return err
		}
		return fn(tx)
	})
}

// execer runs a statement: a transaction.
type execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// apply sets ctx's actor, and the tenant it acts in ("" for none), as settings local to
// tx (they end with it, so nothing survives on a pooled connection), which the audit
// trigger records.
func apply(ctx context.Context, tx execer, actingTenant string) error {
	a := From(ctx)
	_, err := tx.Exec(ctx, `SELECT set_config('app.actor_user_id', $1, true),
		set_config('app.actor_client_id', $2, true), set_config('app.actor_tenant_id', $3, true),
		set_config('app.operation', $4, true), set_config('app.request_id', $5, true),
		set_config('app.ip', $6, true)`,
		a.UserID, a.ClientID, actingTenant, a.Operation, a.RequestID, a.IP)
	return err
}

// Middleware puts the request's actor in its context: who, from caller (the
// authenticated person's user ID and the token's client), the operation as the
// method and chi's route pattern, the request ID, and the client IP the trusted proxy
// reported. It comes after authentication, inside the route group, where the pattern
// is complete.
func Middleware(caller func(*http.Request) (userID, clientID string)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			a := Actor{RequestID: requestid.FromContext(r.Context()), IP: middleware.GetClientIP(r.Context())}
			a.UserID, a.ClientID = caller(r)
			a.Operation = r.Method
			if rc := chi.RouteContext(r.Context()); rc != nil {
				a.Operation += " " + rc.RoutePattern()
			}
			next.ServeHTTP(w, r.WithContext(With(r.Context(), a)))
		})
	}
}
