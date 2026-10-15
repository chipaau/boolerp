//go:build feature

package testdb

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Execer runs a statement: a test's transaction (Tx, OwnerTx) or a pool.
type Execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// Exec runs sql in q, failing the test on an error.
func Exec(t testing.TB, q Execer, sql string, args ...any) {
	t.Helper()
	if _, err := q.Exec(t.Context(), sql, args...); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
}

// ID runs sql, which returns one value (an id, usually RETURNING id), and returns it as
// a string, failing the test on an error.
func ID(t testing.TB, q Querier, sql string, args ...any) string {
	t.Helper()
	var v string
	if err := q.QueryRow(t.Context(), sql, args...).Scan(&v); err != nil {
		t.Fatalf("%s: %v", sql, err)
	}
	return v
}

// Savepoint runs sql in a savepoint of tx, so a statement that fails leaves the test's
// transaction usable; it returns the statement's result.
func Savepoint(t testing.TB, tx pgx.Tx, sql string, args ...any) (pgconn.CommandTag, error) {
	t.Helper()
	sp, err := tx.Begin(t.Context())
	if err != nil {
		t.Fatalf("savepoint: %v", err)
	}
	defer func() { _ = sp.Rollback(context.Background()) }()
	tag, err := sp.Exec(t.Context(), sql, args...)
	if err == nil {
		err = sp.Commit(t.Context())
	}
	return tag, err
}

// PgCode returns err's PostgreSQL error code ("23505", "23514", …), or "" when err is not
// one, so a test asserts the code it expects.
func PgCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

// Savepoints lets code that begins its own transactions (tenant.Tx, actor.Tx) run inside
// a test's transaction: each transaction it begins is a savepoint of the test's, so
// everything still rolls back when the test ends.
type Savepoints struct{ pgx.Tx }

// BeginTx begins a savepoint; the options do not apply to one.
func (s Savepoints) BeginTx(ctx context.Context, _ pgx.TxOptions) (pgx.Tx, error) {
	return s.Begin(ctx)
}
