package db

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/pressly/goose/v3"
)

// Migrate runs a Goose command (up, down, status, up-to <v>, …) against sqlDB using the
// embedded migrations. Shared by cmd/migrate and the integration-test harness so both apply
// the exact same schema + seeds.
func Migrate(ctx context.Context, sqlDB *sql.DB, command string, args ...string) error {
	goose.SetBaseFS(Migrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("goose dialect: %w", err)
	}
	if err := goose.RunContext(ctx, command, sqlDB, "migrations", args...); err != nil {
		return fmt.Errorf("goose %s: %w", command, err)
	}
	return nil
}
