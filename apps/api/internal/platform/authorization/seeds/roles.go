package seeds

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// Roles mirrors the edition's global roles into roles and role_capabilities (C167,
// C177), as the migration role, after authorization.capabilities: a new role is added,
// a changed one updated (and unarchived if it had left), its capabilities made to match
// the code, and a global role no longer declared is archived. Nothing is deleted except
// a capability a role no longer grants (the audit keeps the history).
type Roles struct {
	db    DB
	roles []authorization.Role
	apps  []authorization.App
}

// NewRoles returns the seeder for the edition's global roles of its apps.
func NewRoles(db DB, roles []authorization.Role, apps []authorization.App) *Roles {
	return &Roles{db: db, roles: roles, apps: apps}
}

// Name implements seed.Seeder.
func (*Roles) Name() string { return "authorization.roles" }

// CheckRoles rejects what the tables would refuse, before anything is written: a key
// that is not <app>.<name> of a listed app, a repeated key or name in one app, a blank
// name, or a capability its app does not declare.
func CheckRoles(roles []authorization.Role, apps []authorization.App) error {
	caps := map[string][]string{}
	for _, a := range apps {
		for _, c := range a.Capabilities {
			caps[a.Key] = append(caps[a.Key], c.Key)
		}
	}
	keys, names := map[string]bool{}, map[string]bool{}
	for _, r := range roles {
		app, rest, ok := strings.Cut(r.Key, ".")
		switch {
		case !ok || app != r.App || rest == "":
			return fmt.Errorf("role %q: the key is <app>.<name> of app %s", r.Key, r.App)
		case !slices.ContainsFunc(apps, func(a authorization.App) bool { return a.Key == r.App }):
			return fmt.Errorf("role %s: app %s is not in the edition", r.Key, r.App)
		case keys[r.Key]:
			return fmt.Errorf("role %s declared twice", r.Key)
		case strings.TrimSpace(r.Name) == "":
			return fmt.Errorf("role %s: blank name", r.Key)
		case names[r.App+"/"+strings.ToLower(r.Name)]:
			return fmt.Errorf("role %s: app %s already has a role named %q", r.Key, r.App, r.Name)
		}
		for _, c := range r.Capabilities {
			if !slices.Contains(caps[r.App], c) {
				return fmt.Errorf("role %s: capability %s is not app %s's", r.Key, c, r.App)
			}
		}
		keys[r.Key], names[r.App+"/"+strings.ToLower(r.Name)] = true, true
	}
	return nil
}

// Run implements seed.Seeder, in one transaction.
func (s *Roles) Run(ctx context.Context, env seed.Env) error {
	if err := CheckRoles(s.roles, s.apps); err != nil {
		return err
	}
	keys := make([]string, len(s.roles))
	for i, r := range s.roles {
		keys[i] = r.Key
	}
	var archived int
	err := actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		// Archive the leavers first, so a new role may take a leaver's name.
		tag, err := tx.Exec(ctx, `UPDATE roles SET archived_at = now()
			WHERE tenant_id IS NULL AND archived_at IS NULL AND NOT (key = ANY ($1))`, keys)
		if err != nil {
			return fmt.Errorf("archive roles: %w", err)
		}
		archived = int(tag.RowsAffected())
		for _, r := range s.roles {
			var id string
			if err := tx.QueryRow(ctx, `
				INSERT INTO roles (app_key, key, name, description) VALUES ($1, $2, $3, nullif($4, ''))
				ON CONFLICT (key) DO UPDATE
				SET name = excluded.name, description = excluded.description, archived_at = NULL
				RETURNING id`, r.App, r.Key, r.Name, r.Description).Scan(&id); err != nil {
				return fmt.Errorf("role %s: %w", r.Key, err)
			}
			caps := r.Capabilities
			if caps == nil {
				caps = []string{} // never NULL: a NULL array would remove nothing
			}
			if _, err := tx.Exec(ctx, `DELETE FROM role_capabilities WHERE role_id = $1 AND NOT (capability = ANY ($2))`,
				id, caps); err != nil {
				return fmt.Errorf("role %s: %w", r.Key, err)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO role_capabilities (role_id, capability)
				SELECT $1, c FROM unnest($2::text[]) c ON CONFLICT DO NOTHING`, id, caps); err != nil {
				return fmt.Errorf("role %s: %w", r.Key, err)
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "global roles mirrored", "roles", len(s.roles), "archived", archived)
	return nil
}
