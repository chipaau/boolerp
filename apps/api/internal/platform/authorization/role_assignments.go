package authorization

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// Role assignments made by other platform modules in their own transaction (C231): tenancy
// gives a tenant's invited administrator Control Centre's Administrator (C228) in the
// transaction that invites them, through these functions, never through this module's SQL.

// ErrNoRole is a global role the database does not hold live (not seeded, or archived).
var ErrNoRole = errors.New("authorization: no such global role")

// ErrAppOff is a role whose app is not on in the tenant, so it cannot be assigned there.
var ErrAppOff = errors.New("authorization: the role's app is not on in the tenant")

// AssignGlobalRole gives membershipID, in tenantID, the live global role with key, in tx,
// assigned by the transaction's actor. A membership already holding it is left as it is.
func AssignGlobalRole(ctx context.Context, tx pgx.Tx, tenantID, membershipID, key string) error {
	var role string
	var appOn bool
	err := tx.QueryRow(ctx, `
		SELECT r.id::text,
		       EXISTS (SELECT 1 FROM tenant_apps_on ta WHERE ta.tenant_id = $1 AND ta.app_key = r.app_key)
		  FROM roles r
		 WHERE r.key = $2 AND r.tenant_id IS NULL AND r.archived_at IS NULL`, tenantID, key).Scan(&role, &appOn)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return ErrNoRole
	case err != nil:
		return err
	case !appOn:
		return ErrAppOff
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO role_assignments (tenant_id, membership_id, role_id, assigned_by)
		SELECT $1, $2, $3, nullif(current_setting('app.actor_user_id', true), '')::uuid
		 WHERE NOT EXISTS (SELECT 1 FROM role_assignments
		                    WHERE membership_id = $2 AND role_id = $3 AND active_to IS NULL)`,
		tenantID, membershipID, role)
	return err
}

// EndGlobalRole ends membershipID's open assignment of the global role with key, in tx;
// a membership not holding it is left as it is.
func EndGlobalRole(ctx context.Context, tx pgx.Tx, membershipID, key string) error {
	_, err := tx.Exec(ctx, `
		UPDATE role_assignments ra SET active_to = greatest(now(), ra.active_from)
		  FROM roles r
		 WHERE r.id = ra.role_id AND r.key = $2 AND r.tenant_id IS NULL
		   AND ra.membership_id = $1 AND ra.active_to IS NULL`, membershipID, key)
	return err
}
