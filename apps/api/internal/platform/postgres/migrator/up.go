package migrator

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// Up applies embedded Goose migrations using the separate migration DSN.
// Database and migration errors are returned for the command to classify; the
// command must not log their values because PostgreSQL diagnostics may include
// statement details or caller-supplied values.
func Up(ctx context.Context, dsn string, migrations fs.FS) error {
	if dsn == "" {
		return errors.New("MIGRATE_DSN is required")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return errors.New("MIGRATE_DSN is invalid")
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.PingContext(ctx); err != nil {
		return errors.New("migration database connection failed")
	}
	entries, err := fs.ReadDir(migrations, ".")
	if err != nil {
		return errors.New("migration files could not be read")
	}
	hasMigrations := false
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			hasMigrations = true
			break
		}
	}
	if !hasMigrations {
		// There are no approved schema changes yet. Treat an empty migration set
		// as a successful no-op and avoid creating Goose's metadata table.
		return nil
	}
	quietLogger := slog.New(slog.NewTextHandler(io.Discard, nil))
	provider, err := goose.NewProvider(
		goose.DialectPostgres,
		db,
		migrations,
		goose.WithSlog(quietLogger),
		goose.WithTableName("migrations.goose_db_version"),
	)
	if err != nil {
		return errors.New("migration provider could not be created")
	}
	if _, err := provider.Up(ctx); err != nil {
		return errors.New("database migrations failed")
	}
	return nil
}
