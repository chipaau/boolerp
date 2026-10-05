// Package seeds holds the audit module's seed file: audit_log's monthly partitions
// (C146), which cmd/deploy (production) and cmd/seed (development) create ahead.
package seeds

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// MonthsAhead is how many months, the current one included, each run makes sure
// exist: a release or a seed every quarter keeps rows out of the default partition.
const MonthsAhead = 4

// DB is what the seeder needs: a pool, or a transaction in tests (C79).
type DB interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Partitions creates parent's monthly partitions through audit.create_partitions, as
// the migration role. Existing months are left as they are.
type Partitions struct {
	db     DB
	parent string
	months int
}

// NewPartitions returns the seeder for audit_log.
func NewPartitions(db DB) *Partitions { return NewPartitionsOf(db, "audit_log", MonthsAhead) }

// NewPartitionsOf returns the seeder for another erp_audit table (tests use their own).
func NewPartitionsOf(db DB, parent string, months int) *Partitions {
	return &Partitions{db: db, parent: parent, months: months}
}

// Name implements seed.Seeder.
func (*Partitions) Name() string { return "audit.partitions" }

// Run implements seed.Seeder.
func (p *Partitions) Run(ctx context.Context, env seed.Env) error {
	var created int
	if err := p.db.QueryRow(ctx, `SELECT audit.create_partitions($1::regclass, $2)`, p.parent, p.months).
		Scan(&created); err != nil {
		return fmt.Errorf("create the partitions of %s: %w", p.parent, err)
	}
	env.Logger.InfoContext(ctx, "audit partitions ensured", "created", created, "months", p.months)
	return nil
}
