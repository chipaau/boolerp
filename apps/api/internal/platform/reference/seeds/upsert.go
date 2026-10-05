package seeds

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
)

// DB is what the seeders need: a pool, or a transaction in tests (C79).
type DB interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// row is one seed row: key names it in errors, args fill the upsert's parameters.
type row struct {
	key  string
	args []any
}

// counts are what an upsert run did.
type counts struct{ inserted, updated, unchanged int }

// upsertAll runs sql for every row in one transaction, so a failure leaves the
// table as it was. sql adds a row or updates a changed one and returns
// `xmax = 0` (true for a new row) only when it wrote; no row back means unchanged.
func upsertAll(ctx context.Context, db DB, sql string, rows []row) (counts, error) {
	var n counts
	// One transaction, attributed to the seeder in the audit (C164).
	err := actor.Tx(ctx, db, func(ctx context.Context, tx pgx.Tx) error {
		for _, r := range rows {
			var isNew bool
			err := tx.QueryRow(ctx, sql, r.args...).Scan(&isNew)
			switch {
			case errors.Is(err, pgx.ErrNoRows):
				n.unchanged++
			case err != nil:
				return fmt.Errorf("%s: %w", r.key, err)
			case isNew:
				n.inserted++
			default:
				n.updated++
			}
		}
		return nil
	})
	if err != nil {
		return counts{}, err
	}
	return n, nil
}
