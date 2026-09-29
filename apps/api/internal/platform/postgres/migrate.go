package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

// HistoryTable is where Goose records applied migrations: a private schema the
// runtime role cannot read (created by docker/postgres/init/10-roles.sh).
const HistoryTable = "migrations.goose_db_version"

// OpenDB returns a database/sql handle for s, which Goose requires. Like
// NewPool, it does not connect until first use, and pgx's parse error is never
// wrapped.
func OpenDB(s Settings) (*sql.DB, error) {
	cfg, err := pgx.ParseConfig(connString(s))
	if err != nil {
		return nil, ErrInvalidSettings
	}
	return stdlib.OpenDB(*cfg), nil
}

// Migrate applies every pending migration in fsys, in version order, and
// returns how many it applied (C46).
//
// A PostgreSQL advisory lock serializes concurrent runs, so two deploy jobs
// cannot apply migrations at the same time. Migrations are forward-only: there
// is no down command. Progress is logged through logger.
func Migrate(ctx context.Context, db *sql.DB, fsys fs.FS, logger *slog.Logger) (int, error) {
	// Connect first, even when there is nothing to apply, so wrong credentials or
	// an unreachable server fail the run instead of reporting success.
	if err := db.PingContext(ctx); err != nil {
		return 0, fmt.Errorf("connect to PostgreSQL: %w", err)
	}

	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return 0, fmt.Errorf("create migration lock: %w", err)
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, db, fsys,
		goose.WithSessionLocker(locker),
		goose.WithTableName(HistoryTable),
		goose.WithDisableGlobalRegistry(true), // only the given files, no init()-registered Go migrations
		goose.WithSlog(logger),
	)
	if errors.Is(err, goose.ErrNoMigrations) {
		// A release with no migrations is valid: there is nothing to apply.
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("load migrations: %w", err)
	}

	results, err := provider.Up(ctx)
	if err != nil {
		return 0, safeError(err)
	}
	return len(results), nil
}

// safeError reports a failed migration without the SQL statement or row values.
// Goose's error quotes the failing statement, and PostgreSQL's error detail can
// contain row values ("Key (email)=(...) already exists"); only the migration
// file, SQLSTATE code, and primary message are kept.
func safeError(err error) error {
	var partial *goose.PartialError
	if !errors.As(err, &partial) {
		return err
	}
	file := "unknown migration"
	if partial.Failed != nil && partial.Failed.Source != nil {
		file = partial.Failed.Source.Path
	}
	var pgErr *pgconn.PgError
	if errors.As(partial.Err, &pgErr) {
		return fmt.Errorf("migration %s failed: %s (SQLSTATE %s)", file, pgErr.Message, pgErr.Code)
	}
	return fmt.Errorf("migration %s failed", file)
}
