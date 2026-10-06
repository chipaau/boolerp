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

// Capabilities mirrors the edition's apps' capabilities into the capabilities table
// (C168), as the migration role, after authorization.apps: a new one is added, a changed
// one updated (and made active again if it had left), and one no longer declared gets
// active_to. No row is ever deleted.
type Capabilities struct {
	db   DB
	apps []authorization.App
}

// NewCapabilities returns the seeder for the edition's apps' capabilities.
func NewCapabilities(db DB, apps []authorization.App) *Capabilities {
	return &Capabilities{db: db, apps: apps}
}

// Name implements seed.Seeder.
func (*Capabilities) Name() string { return "authorization.capabilities" }

var capabilityKey = regexp.MustCompile(`^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:(view|manage|delete)$`)

// CheckCapabilities rejects what the table would refuse, before anything is written: a
// malformed key, one declared twice (in any app), or a blank name.
func CheckCapabilities(apps []authorization.App) error {
	seen := map[string]string{}
	for _, a := range apps {
		for _, c := range a.Capabilities {
			switch {
			case !capabilityKey.MatchString(c.Key):
				return fmt.Errorf("app %s: capability key %q", a.Key, c.Key)
			case seen[c.Key] != "":
				return fmt.Errorf("capability %s declared by %s and %s", c.Key, seen[c.Key], a.Key)
			case strings.TrimSpace(c.Name) == "":
				return fmt.Errorf("capability %s: blank name", c.Key)
			}
			seen[c.Key] = a.Key
		}
	}
	return nil
}

// Run implements seed.Seeder, in one transaction.
func (s *Capabilities) Run(ctx context.Context, env seed.Env) error {
	if err := CheckCapabilities(s.apps); err != nil {
		return err
	}
	keys := []string{} // never nil: a NULL array would retire nothing
	var written, retired int
	err := actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		for _, a := range s.apps {
			for _, c := range a.Capabilities {
				keys = append(keys, c.Key)
				tag, err := tx.Exec(ctx, `
					INSERT INTO capabilities (key, app_key, name, description) VALUES ($1, $2, $3, nullif($4, ''))
					ON CONFLICT (key) DO UPDATE
					SET app_key = excluded.app_key, name = excluded.name, description = excluded.description,
					    active_to = NULL
					WHERE (capabilities.app_key, capabilities.name, capabilities.description, capabilities.active_to)
					      IS DISTINCT FROM (excluded.app_key, excluded.name, excluded.description, NULL::timestamptz)`,
					c.Key, a.Key, c.Name, c.Description)
				if err != nil {
					return fmt.Errorf("capability %s: %w", c.Key, err)
				}
				written += int(tag.RowsAffected())
			}
		}
		tag, err := tx.Exec(ctx, `UPDATE capabilities SET active_to = now()
			WHERE active_to IS NULL AND NOT (key = ANY ($1))`, keys)
		if err != nil {
			return fmt.Errorf("retire capabilities: %w", err)
		}
		retired = int(tag.RowsAffected())
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "capabilities mirrored", "capabilities", len(keys), "written", written, "retired", retired)
	return nil
}
