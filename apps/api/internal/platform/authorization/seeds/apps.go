// Package seeds holds the authorization module's seed files (C135): the app catalogue,
// mirrored from code into the apps table on every cmd/deploy and cmd/seed (C165).
package seeds

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// DB is what the seeder needs: a pool, or a transaction in tests (C79).
type DB interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Apps mirrors the edition's apps into the apps table, as the migration role: a new
// app is added, a changed one updated (and made active again if it had left), and an
// app no longer in the list gets active_to. No row is ever deleted.
type Apps struct {
	db   DB
	apps []authorization.App
}

// NewApps returns the seeder for the edition's apps.
func NewApps(db DB, apps []authorization.App) *Apps { return &Apps{db: db, apps: apps} }

// Name implements seed.Seeder.
func (*Apps) Name() string { return "authorization.apps" }

var appKey = regexp.MustCompile(`^[a-z][a-z0-9-]{1,30}$`)

// Check rejects a list the table would refuse, before anything is written: a bad or
// repeated key, a blank name, or an unknown kind.
func Check(apps []authorization.App) error {
	seen := map[string]bool{}
	for _, a := range apps {
		switch {
		case !appKey.MatchString(a.Key):
			return fmt.Errorf("app key %q", a.Key)
		case seen[a.Key]:
			return fmt.Errorf("app %s listed twice", a.Key)
		case strings.TrimSpace(a.Name) == "":
			return fmt.Errorf("app %s: blank name", a.Key)
		case a.Kind != authorization.Workspace && a.Kind != authorization.Operator && a.Kind != authorization.Product:
			return fmt.Errorf("app %s: kind %q", a.Key, a.Kind)
		}
		seen[a.Key] = true
	}
	return nil
}

// Run implements seed.Seeder, in one transaction.
func (s *Apps) Run(ctx context.Context, env seed.Env) error {
	if err := Check(s.apps); err != nil {
		return err
	}
	keys := make([]string, len(s.apps))
	for i, a := range s.apps {
		keys[i] = a.Key
	}
	var written, retired int
	err := actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		for _, a := range s.apps {
			tag, err := tx.Exec(ctx, `
				INSERT INTO apps (key, name, kind, description) VALUES ($1, $2, $3, nullif($4, ''))
				ON CONFLICT (key) DO UPDATE
				SET name = excluded.name, kind = excluded.kind, description = excluded.description, active_to = NULL
				WHERE (apps.name, apps.kind, apps.description, apps.active_to)
				      IS DISTINCT FROM (excluded.name, excluded.kind, excluded.description, NULL::timestamptz)`,
				a.Key, a.Name, string(a.Kind), a.Description)
			if err != nil {
				return fmt.Errorf("app %s: %w", a.Key, err)
			}
			written += int(tag.RowsAffected())
		}
		tag, err := tx.Exec(ctx, `UPDATE apps SET active_to = now() WHERE active_to IS NULL AND key <> ALL ($1)`, keys)
		if err != nil {
			return fmt.Errorf("retire apps: %w", err)
		}
		retired = int(tag.RowsAffected())
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "apps mirrored", "apps", len(s.apps), "written", written, "retired", retired)
	return nil
}
