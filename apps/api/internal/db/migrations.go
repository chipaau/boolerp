// Package db holds the embedded SQL migrations applied by cmd/migrate (Goose).
// Embedding keeps the self-host promise: one binary carries its own schema.
package db

import "embed"

//go:embed migrations/*.sql
var Migrations embed.FS
