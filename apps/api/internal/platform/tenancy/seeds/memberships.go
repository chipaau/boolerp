package seeds

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// Member is a person a seeder makes an active member of a tenant, found by their
// user's email. Owner makes them the tenant's owner, unless it already has one.
type Member struct {
	Email string
	Owner bool
}

// Grant is a membership of a sample tenant, by the tenant's slug.
type Grant struct {
	Tenant string
	Member
}

// TeamOwner owns the operator tenant and, in development, every sample tenant
// (the user's choice, 2026-10-05).
const TeamOwner = "shifau@bool.mv"

// OperatorMembers makes the team active members of the operator tenant (C160),
// production's starting data like the team's accounts: cmd/deploy runs it after
// creating them, cmd/seed after the demo seeder has. It writes as the table owner:
// tenancy has no invite operation yet, so this is a recorded exception to seeding
// through use cases (C50), like Samples. A person who already has a live membership
// is left as they are, so changes made later stay.
type OperatorMembers struct {
	db      DB
	members []Member
}

// NewOperatorMembers returns the seeder over db for members.
func NewOperatorMembers(db DB, members []Member) *OperatorMembers {
	return &OperatorMembers{db: db, members: members}
}

// Name implements seed.Seeder.
func (*OperatorMembers) Name() string { return "tenancy.operator_members" }

// Run implements seed.Seeder, in one transaction.
func (s *OperatorMembers) Run(ctx context.Context, env seed.Env) error {
	return actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		var tenantID string
		if err := tx.QueryRow(ctx, `SELECT id FROM tenants WHERE is_operator`).Scan(&tenantID); err != nil {
			// tenancy.operator, a seed file, runs first.
			return fmt.Errorf("find the operator: %w", err)
		}
		var created, existing int
		for _, m := range s.members {
			added, err := grant(ctx, tx, tenantID, m)
			if err != nil {
				return fmt.Errorf("operator member: %w", err)
			}
			count(added, &created, &existing)
		}
		// Counts only: emails are personal data, never logged (C94).
		env.Logger.InfoContext(ctx, "operator members ensured", "created", created, "existing", existing)
		return nil
	})
}

// SampleMembers gives development's sample tenants their members (C143, C160): the
// team in every sample, then the extra grants (the end-to-end account). Dev only,
// as the table owner like Samples.
type SampleMembers struct {
	db    DB
	data  []byte
	team  []Member
	extra []Grant
}

// NewSampleMembers returns the seeder over db for the embedded sample tenants.
func NewSampleMembers(db DB, team []Member, extra ...Grant) *SampleMembers {
	return NewSampleMembersFrom(db, sampleTenantsCSV, team, extra...)
}

// NewSampleMembersFrom returns the seeder over db for another sample tenants list
// in the same format (tests use their own test tenants).
func NewSampleMembersFrom(db DB, data []byte, team []Member, extra ...Grant) *SampleMembers {
	return &SampleMembers{db: db, data: data, team: team, extra: extra}
}

// Name implements seed.Seeder.
func (*SampleMembers) Name() string { return "tenancy.sample_members" }

// Run implements seed.Seeder, in one transaction.
func (s *SampleMembers) Run(ctx context.Context, env seed.Env) error {
	if env.Environment != "dev" {
		env.Logger.InfoContext(ctx, "sample members are seeded only in dev; skipped")
		return nil
	}
	samples, err := ParseSamples(s.data)
	if err != nil {
		return err
	}
	var grants []Grant
	for _, sample := range samples {
		for _, m := range s.team {
			grants = append(grants, Grant{Tenant: sample.Slug, Member: m})
		}
	}
	grants = append(grants, s.extra...)

	return actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		var created, existing int
		for _, g := range grants {
			var tenantID string
			if err := tx.QueryRow(ctx, `SELECT id FROM tenants WHERE slug = $1`, g.Tenant).Scan(&tenantID); err != nil {
				// tenancy.sample_tenants runs first.
				return fmt.Errorf("sample member of %s: %w", g.Tenant, err)
			}
			added, err := grant(ctx, tx, tenantID, g.Member)
			if err != nil {
				return fmt.Errorf("sample member of %s: %w", g.Tenant, err)
			}
			count(added, &created, &existing)
		}
		env.Logger.InfoContext(ctx, "sample members seeded", "created", created, "existing", existing)
		return nil
	})
}

// errNoUser is a member without a user: the identity seeders create the accounts first.
var errNoUser = errors.New("no user with this email; the accounts are seeded first")

// grant makes m an active member of the tenant, its owner if m.Owner and the tenant
// has none, unless m has a live membership there already. It reports whether it
// created one. The error never names the email (personal data, C94).
func grant(ctx context.Context, tx pgx.Tx, tenantID string, m Member) (bool, error) {
	var userID string
	err := tx.QueryRow(ctx, `SELECT id FROM users WHERE lower(email) = lower($1)`, m.Email).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, errNoUser
	}
	if err != nil {
		// More than one row is an error too: an email must name one person here.
		return false, fmt.Errorf("find the user: %w", err)
	}
	tag, err := tx.Exec(ctx, `
		INSERT INTO memberships (tenant_id, user_id, status, joined_at, is_owner)
		SELECT $1, $2, 'active', now(),
		       $3 AND NOT EXISTS (SELECT 1 FROM memberships WHERE tenant_id = $1 AND is_owner)
		 WHERE NOT EXISTS (SELECT 1 FROM memberships
		                    WHERE tenant_id = $1 AND user_id = $2 AND status <> 'ended')`,
		tenantID, userID, m.Owner)
	if err != nil {
		return false, fmt.Errorf("add the membership: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

// count adds one to created or existing.
func count(added bool, created, existing *int) {
	if added {
		*created++
	} else {
		*existing++
	}
}
