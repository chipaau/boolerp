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

	// No fallback: MIGRATE_DSN connects as the schema OWNER, so a default here would be a
	// privileged credential compiled into the binary — and a deployment that forgot to set it would
	// migrate whatever database the default happened to reach. Local values live in .env.
	dsn := os.Getenv("MIGRATE_DSN")
	if dsn == "" {
		slog.Error("MIGRATE_DSN is not set (local setup: cp .env.example .env)")
		os.Exit(1)
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
