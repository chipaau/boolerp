// Command migrate applies the embedded Goose SQL migrations. It connects as the database
// OWNER (not the least-privilege app role) because migrations create tables, roles, and grants.
//
// Usage: migrate [up|down|status|version|reset|up-to <v>|down-to <v>]  (default: up)
// DSN comes from MIGRATE_DSN (falls back to the local dev owner DSN).
package main

import (
	"context"
	"database/sql"
	"flag"
	"log/slog"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver

	"github.com/boolmv/erp/internal/db"
)

const defaultDSN = "postgres://erp:erp@postgres:5432/erp?sslmode=disable"

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	flag.Parse()

	command := flag.Arg(0)
	if command == "" {
		command = "up"
	}
	var args []string
	if flag.NArg() > 1 {
		args = flag.Args()[1:]
	}

	dsn := os.Getenv("MIGRATE_DSN")
	if dsn == "" {
		dsn = defaultDSN
	}

	if err := run(command, dsn, args); err != nil {
		slog.Error("migrate failed", "command", command, "err", err)
		os.Exit(1)
	}
	slog.Info("migrate done", "command", command)
}

func run(command, dsn string, args []string) error {
	sqlDB, err := sql.Open("pgx", dsn)
	if err != nil {
		return err
	}
	defer func() { _ = sqlDB.Close() }()

	return db.Migrate(context.Background(), sqlDB, command, args...)
}
