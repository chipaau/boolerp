package seeds

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// TeamRoles gives the team a global role in the operator tenant (C177): production's
// starting data, so Bool's staff can use the admin console. cmd/deploy runs it after the
// team's memberships, cmd/seed with the memberships. Each person is found by their user's
// email and their active membership of the operator tenant; one who already holds the
// role, or whose assignment was revoked (an operator's decision), is left as they are.
// Owner-role seeds read the registry directly, as tenancy's read users (C166).
type TeamRoles struct {
	db      DB
	emails  []string
	roleKey string
}

// NewTeamRoles returns the seeder that gives the people with these emails roleKey.
func NewTeamRoles(db DB, emails []string, roleKey string) *TeamRoles {
	return &TeamRoles{db: db, emails: emails, roleKey: roleKey}
}

// Name implements seed.Seeder.
func (*TeamRoles) Name() string { return "authorization.team_roles" }

// Run implements seed.Seeder, in one transaction.
func (s *TeamRoles) Run(ctx context.Context, env seed.Env) error {
	var created, existing int
	err := actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		var roleID, tenantID string
		if err := tx.QueryRow(ctx, `SELECT r.id, t.id FROM roles r, tenants t
			WHERE r.key = $1 AND r.tenant_id IS NULL AND t.is_operator`, s.roleKey).Scan(&roleID, &tenantID); err != nil {
			// authorization.roles and tenancy.operator run first.
			return fmt.Errorf("role %s in the operator tenant: %w", s.roleKey, err)
		}
		for i, email := range s.emails {
			var membershipID string
			err := tx.QueryRow(ctx, `SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id
				WHERE m.tenant_id = $1 AND m.status = 'active' AND lower(u.email) = lower($2)`,
				tenantID, email).Scan(&membershipID)
			if errors.Is(err, pgx.ErrNoRows) {
				// The email is personal data (C94): name the team member by position.
				return fmt.Errorf("team member %d has no active membership of the operator tenant", i+1)
			}
			if err != nil {
				return fmt.Errorf("team member %d: %w", i+1, err)
			}
			tag, err := tx.Exec(ctx, `
				INSERT INTO role_assignments (tenant_id, membership_id, role_id)
				SELECT $1, $2, $3
				 WHERE NOT EXISTS (SELECT 1 FROM role_assignments WHERE membership_id = $2 AND role_id = $3)`,
				tenantID, membershipID, roleID)
			if err != nil {
				return fmt.Errorf("team member %d: %w", i+1, err)
			}
			if tag.RowsAffected() == 1 {
				created++
			} else {
				existing++
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "team roles ensured", "role", s.roleKey, "created", created, "existing", existing)
	return nil
}
