package seeds

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// TenantApps turns apps on for tenants (C166), as the table owner: the operator tenant's
// apps in every database, and the sample tenants' in development. A tenant with the app
// already on is left as it is; one that turned it off is too (an operator's choice).
// Tenants are found by slug, or the operator by its flag: a seed reads the registry
// directly, as the tenancy seeds read users (owner-role seeds only).
type TenantApps struct {
	db      DB
	name    string
	devOnly bool
	slugs   []string // nil: the operator tenant
	apps    []string
}

// NewOperatorApps returns the seeder that turns apps on for the operator tenant.
func NewOperatorApps(db DB, apps ...string) *TenantApps {
	return &TenantApps{db: db, name: "authorization.operator_apps", apps: apps}
}

// NewSampleApps returns the development seeder that turns apps on for the sample
// tenants with these slugs.
func NewSampleApps(db DB, slugs []string, apps ...string) *TenantApps {
	return &TenantApps{db: db, name: "authorization.sample_apps", devOnly: true, slugs: slugs, apps: apps}
}

// Name implements seed.Seeder.
func (s *TenantApps) Name() string { return s.name }

// Run implements seed.Seeder, in one transaction.
func (s *TenantApps) Run(ctx context.Context, env seed.Env) error {
	if s.devOnly && env.Environment != "dev" {
		env.Logger.InfoContext(ctx, "sample apps are seeded only in dev; skipped")
		return nil
	}
	var created, existing int
	err := actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		tenants, err := s.tenants(ctx, tx)
		if err != nil {
			return err
		}
		for _, tenant := range tenants {
			for _, app := range s.apps {
				// Any activation, live or ended, means the app has been decided for the tenant.
				tag, err := tx.Exec(ctx, `
					INSERT INTO tenant_apps (tenant_id, app_key)
					SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM tenant_apps WHERE tenant_id = $1 AND app_key = $2)`,
					tenant, app)
				if err != nil {
					return fmt.Errorf("app %s: %w", app, err)
				}
				if tag.RowsAffected() == 1 {
					created++
				} else {
					existing++
				}
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "tenant apps ensured", "created", created, "existing", existing)
	return nil
}

// tenants returns the ids of the tenants to seed.
func (s *TenantApps) tenants(ctx context.Context, tx pgx.Tx) ([]string, error) {
	if s.slugs == nil {
		var id string
		if err := tx.QueryRow(ctx, `SELECT id FROM tenants WHERE is_operator`).Scan(&id); err != nil {
			// tenancy.operator, a seed file, runs first.
			return nil, fmt.Errorf("find the operator: %w", err)
		}
		return []string{id}, nil
	}
	ids := make([]string, 0, len(s.slugs))
	for _, slug := range s.slugs {
		var id string
		if err := tx.QueryRow(ctx, `SELECT id FROM tenants WHERE slug = $1`, slug).Scan(&id); err != nil {
			// tenancy.sample_tenants runs first.
			return nil, fmt.Errorf("sample tenant %s: %w", slug, err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}
