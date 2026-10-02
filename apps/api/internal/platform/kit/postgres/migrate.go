package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"regexp"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
)

// ModuleMigrations are one module's migrations (C48, C95): its name and its
// embedded SQL files. Each module's history is kept in its own Goose table,
// HistoryTable(Name), so modules' version numbers never collide.
type ModuleMigrations struct {
	Name string // lowercase letters, digits, and underscores, such as "identity"
	FS   fs.FS
}

// moduleName is what a module name may contain; it becomes part of a table name.
var moduleName = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// HistoryTable is where Goose records a module's applied migrations: a private
// schema the runtime role cannot read (created by docker/postgres/init).
func HistoryTable(module string) string {
	return "migrations." + module + "_version"
}

// MigrateModules applies each module's pending migrations, in the order given
// (dependency order, so referenced tables exist first), and returns how many it
// applied in all. It stops at the first failure.
func MigrateModules(ctx context.Context, db *sql.DB, modules []ModuleMigrations, logger *slog.Logger) (int, error) {
	// Connect first, even when there is nothing to apply, so wrong credentials or
	// an unreachable server fail the run instead of reporting success.
	if err := db.PingContext(ctx); err != nil {
		return 0, fmt.Errorf("connect to PostgreSQL: %w", err)
	}
	total := 0
	for _, m := range modules {
		if !moduleName.MatchString(m.Name) {
			return total, fmt.Errorf("invalid module name %q", m.Name)
		}
		applied, err := Migrate(ctx, db, m.FS, HistoryTable(m.Name), logger.With("module", m.Name))
		total += applied
		if err != nil {
			return total, fmt.Errorf("module %s: %w", m.Name, err)
		}
	}
	return total, nil
}

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

// Migrate applies every pending migration in fsys, in version order, recording
// them in historyTable, and returns how many it applied (C46).
//
// A PostgreSQL advisory lock serializes concurrent runs, so two deploy jobs
// cannot apply migrations at the same time. Migrations are forward-only: there
// is no down command. Progress is logged through logger.
func Migrate(ctx context.Context, db *sql.DB, fsys fs.FS, historyTable string, logger *slog.Logger) (int, error) {
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
		goose.WithTableName(historyTable),
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
