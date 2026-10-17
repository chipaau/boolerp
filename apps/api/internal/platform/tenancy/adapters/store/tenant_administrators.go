package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// TenantAdministratorListSpec is what GET /api/v1/tenants/{id}/administrators accepts: the
// tenant's administrator invitations, in the order they were made.
var TenantAdministratorListSpec = request.ListSpec{Sorts: []string{"created"}, DefaultSort: "created"}

// TenantAdministrator is an administrator the operator invited to a tenant (C228, C230): an
// invited membership naming an e-mail, and whether its invitation has been sent.
type TenantAdministrator struct {
	ID, Email, Name string
	IsOwner         bool
	InviteExpiresAt *time.Time // null until sent, when the tenant is activated
	CreatedAt       time.Time
}

const tenantAdministratorColumns = `m.id::text, m.invite_email, m.invite_name, m.is_owner, m.invite_expires_at, m.created_at`

func scanTenantAdministrator(row pgx.Row, a *TenantAdministrator, extra ...any) error {
	return row.Scan(append([]any{&a.ID, &a.Email, &a.Name, &a.IsOwner, &a.InviteExpiresAt, &a.CreatedAt}, extra...)...)
}

// ListTenantAdministrators reads a tenant's administrator invitations and how many it has.
func ListTenantAdministrators(ctx context.Context, tx pgx.Tx, tenant string, l request.List) ([]TenantAdministrator, int, error) {
	q := postgres.ListQuery{From: "memberships m", Key: "m.id", Sorts: map[string]string{"created": "m.created_at"}}
	q.Equal("m.tenant_id", tenant)
	q.Where("m.status = 'invited' AND m.invite_email IS NOT NULL")
	items := []TenantAdministrator{}
	total, err := q.Run(ctx, tx, l, tenantAdministratorColumns, func(rows pgx.Rows, total *int) error {
		var a TenantAdministrator
		if err := scanTenantAdministrator(rows, &a, total); err != nil {
			return err
		}
		items = append(items, a)
		return nil
	})
	return items, total, err
}

// NewTenantAdministrator is an administrator to invite: the address (lowercase), the name
// the operator entered, and whether they are an owner (C198).
type NewTenantAdministrator struct {
	Email, Name string
	IsOwner     bool
}

// InviteTenantAdministrator invites n to tenant, invited by the transaction's actor, and
// returns the invitation and whether it is new: a live invitation for that address is
// returned as it is. It waits on the address until an account verifies it (C230).
func InviteTenantAdministrator(ctx context.Context, tx pgx.Tx, tenant string, n NewTenantAdministrator) (TenantAdministrator, bool, error) {
	var a TenantAdministrator
	err := scanTenantAdministrator(tx.QueryRow(ctx, `
		INSERT INTO memberships AS m (tenant_id, invite_email, invite_name, is_owner, invited_by)
		VALUES ($1, $2, $3, $4, nullif(current_setting('app.actor_user_id', true), '')::uuid)
		ON CONFLICT (tenant_id, invite_email) WHERE status = 'invited' DO NOTHING
		RETURNING `+tenantAdministratorColumns, tenant, n.Email, n.Name, n.IsOwner), &a)
	if err == nil {
		return a, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return a, false, err
	}
	err = scanTenantAdministrator(tx.QueryRow(ctx, `SELECT `+tenantAdministratorColumns+` FROM memberships m
		WHERE m.tenant_id = $1 AND m.invite_email = $2 AND m.status = 'invited'`, tenant, n.Email), &a)
	return a, false, err
}

// CancelTenantAdministrator ends tenant's administrator invitation id, reporting whether
// there was one: an invitation already claimed or ended is left as it is.
func CancelTenantAdministrator(ctx context.Context, tx pgx.Tx, tenant, id string) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE memberships SET status = 'ended', ended_at = now(), is_owner = false
		WHERE tenant_id = $1 AND id::text = $2 AND status = 'invited' AND invite_email IS NOT NULL`, tenant, id)
	return tag.RowsAffected() > 0, err
}
