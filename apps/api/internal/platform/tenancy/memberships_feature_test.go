//go:build feature

package tenancy_test

import (
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// user inserts a user with a Kratos ID only this package's tests use (n picks it) and
// returns its id.
func (w *world) user(t *testing.T, n int) string {
	t.Helper()
	return testdb.ID(t, w.tx, `INSERT INTO users (kratos_identity_id, email, phone) VALUES ($1, $2, '+9990000000') RETURNING id`,
		fmt.Sprintf("0192f6a0-0000-7000-8000-00000e%06d", n), fmt.Sprintf("member%d@x-tenancy.test", n))
}

// member adds an active membership and returns its id.
func (w *world) member(t *testing.T, tenant, user string, owner bool) string {
	t.Helper()
	return testdb.ID(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at, is_owner)
		VALUES ($1, $2, 'active', now(), $3) RETURNING id`, tenant, user, owner)
}

// invite adds an invited membership and returns its id.
func (w *world) invite(t *testing.T, tenant, user string) string {
	t.Helper()
	return testdb.ID(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at)
		VALUES ($1, $2, now() + interval '7 days') RETURNING id`, tenant, user)
}

func TestFeatureAPersonIsAMemberOfSeveralTenants(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	u := w.user(t, 1)
	w.member(t, a, u, true)
	w.invite(t, b, u)
	assert.Equal(t, 2, testdb.Count(t, w.tx, "memberships", map[string]any{"user_id": u}))
}

func TestFeatureMembershipConstraints(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	u := w.user(t, 1)
	v := w.user(t, 2)
	w.member(t, a, u, true)

	for name, sql := range map[string]string{
		"second live membership":               `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, '` + u + `', now())`,
		"unknown status":                       `INSERT INTO memberships (tenant_id, user_id, status) VALUES ($1, '` + v + `', 'pending')`,
		"invited without a user or an address": `INSERT INTO memberships (tenant_id) VALUES ($1)`,
		"active without a user":                `INSERT INTO memberships (tenant_id, invite_email, invite_name, status, joined_at) VALUES ($1, 'x@x-tenancy.test', 'X', 'active', now())`,
		"an address not lowercase":             `INSERT INTO memberships (tenant_id, invite_email, invite_name) VALUES ($1, 'X@x-tenancy.test', 'X')`,
		"a blank name":                         `INSERT INTO memberships (tenant_id, invite_email, invite_name) VALUES ($1, 'x@x-tenancy.test', ' ')`,
		"active without joining":               `INSERT INTO memberships (tenant_id, user_id, status) VALUES ($1, '` + v + `', 'active')`,
		"disabled without the time":            `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, '` + v + `', 'disabled', now())`,
		"ended without the time":               `INSERT INTO memberships (tenant_id, user_id, status) VALUES ($1, '` + v + `', 'ended')`,
		"disabled owner":                       `INSERT INTO memberships (tenant_id, user_id, status, joined_at, disabled_at, is_owner) VALUES ($1, '` + v + `', 'disabled', now(), now(), true)`,
		"unknown user":                         `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, '0192f6a0-0000-7000-8000-000000000000', now())`,
	} {
		_, err := testdb.Savepoint(t, w.tx, sql, a)
		assert.Error(t, err, name)
	}
}

func TestFeatureAnEndedMembershipIsHistory(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	u := w.user(t, 1)
	first := w.member(t, a, u, false)
	testdb.Exec(t, w.tx, `UPDATE memberships SET status = 'ended', ended_at = now() WHERE id = $1`, first)

	// Rejoining is a new row; the ended one is frozen.
	w.invite(t, a, u)
	assert.Equal(t, 2, testdb.Count(t, w.tx, "memberships", map[string]any{"tenant_id": a, "user_id": u}))
	_, err := testdb.Savepoint(t, w.tx, `UPDATE memberships SET status = 'active', ended_at = null WHERE id = $1`, first)
	assert.Equal(t, "23514", testdb.PgCode(err), "an ended membership cannot change")
}

func TestFeatureAMembershipsTenantAndUserNeverChange(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	u := w.user(t, 1)
	v := w.user(t, 2)
	m := w.member(t, a, u, false)

	for name, sql := range map[string]string{
		"tenant": `UPDATE memberships SET tenant_id = '` + b + `' WHERE id = $1`,
		"user":   `UPDATE memberships SET user_id = '` + v + `' WHERE id = $1`,
	} {
		_, err := testdb.Savepoint(t, w.tx, sql, m)
		assert.Equal(t, "23514", testdb.PgCode(err), name)
	}
}

func TestFeatureDisablingIsReversible(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	m := w.member(t, a, w.user(t, 1), false)
	testdb.Exec(t, w.tx, `UPDATE memberships SET status = 'disabled', disabled_at = now() WHERE id = $1`, m)
	testdb.Exec(t, w.tx, `UPDATE memberships SET status = 'active', disabled_at = null WHERE id = $1`, m)
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": m, "status": "active"})
}

func TestFeatureATenantHasSeveralOwners(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	w.member(t, a, w.user(t, 1), true)
	w.member(t, a, w.user(t, 2), true)
	w.invite(t, a, w.user(t, 3))
	testdb.Exec(t, w.tx, `UPDATE memberships SET is_owner = true WHERE tenant_id = $1 AND status = 'invited'`, a)
	assert.Equal(t, 3, testdb.Count(t, w.tx, "memberships", map[string]any{"tenant_id": a, "is_owner": true}),
		"an invited member may be an owner too (C198)")
}

func TestFeatureActivationNeedsAnOwner(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	testdb.Exec(t, w.tx, `INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary)
		VALUES ($1, 'x_tenancy_type', true)`, a)
	w.member(t, a, w.user(t, 1), false)
	err := w.commitCheck(t, `UPDATE tenants SET status = 'active', activated_at = now() WHERE id = $1`, a)
	assert.Equal(t, "23514", testdb.PgCode(err), "a member who is not an owner is not enough")

	w.invite(t, a, w.user(t, 2))
	testdb.Exec(t, w.tx, `UPDATE memberships SET is_owner = true WHERE tenant_id = $1 AND status = 'invited'`, a)
	require.NoError(t, w.commitCheck(t, `UPDATE tenants SET status = 'active', activated_at = now() WHERE id = $1`, a),
		"an invited owner is enough")
}

func TestFeatureAProvisioningTenantNeedsNoOwner(t *testing.T) {
	w := newWorld(t)
	w.tenant(t, "x-a", "XTA")
	testdb.Exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
}

func TestFeatureAnActiveTenantKeepsAtLeastOneOwner(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	w.activate(t, a) // its owner: w.owner
	last := testdb.ID(t, w.tx, `SELECT id FROM memberships WHERE tenant_id = $1 AND is_owner`, a)

	for name, sql := range map[string]string{
		"unflagging the last owner": `UPDATE memberships SET is_owner = false WHERE id = $1`,
		"deleting the last owner":   `DELETE FROM memberships WHERE id = $1`,
	} {
		err := w.commitCheck(t, sql, last)
		assert.Equal(t, "23514", testdb.PgCode(err), name)
	}

	// Ownership moves by adding another owner, then stepping down.
	next := w.member(t, a, w.user(t, 2), true)
	require.NoError(t, w.commitCheck(t, `UPDATE memberships SET is_owner = false WHERE id = $1`, last))
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": next, "is_owner": true})
}

func TestFeatureMembershipUpdatedAtFollowsChanges(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	m := testdb.ID(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at, updated_at)
		VALUES ($1, $2, now(), '2000-01-01') RETURNING id`, a, w.user(t, 1))
	testdb.Exec(t, w.tx, `UPDATE memberships SET invite_expires_at = now() + interval '1 day' WHERE id = $1`, m)
	var setToNow bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT updated_at = now() FROM memberships WHERE id = $1`, m).Scan(&setToNow))
	assert.True(t, setToNow)
}

func TestFeatureActiveMembershipLookup(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	u := w.user(t, 1)
	invited := w.user(t, 2)
	m := w.member(t, a, u, true)
	w.invite(t, a, invited)

	type found struct {
		MembershipID string
		IsOwner      bool
		TenantStatus string
	}
	lookup := func(tenant, user string) []found {
		rows, err := w.tx.Query(t.Context(), `SELECT membership_id::text, is_owner, tenant_status
			FROM lookup.active_membership($1, $2)`, tenant, user)
		require.NoError(t, err)
		got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[found])
		require.NoError(t, err)
		return got
	}
	assert.Equal(t, []found{{MembershipID: m, IsOwner: true, TenantStatus: "provisioning"}}, lookup(a, u))
	assert.Empty(t, lookup(a, invited), "an invitation is not access")
	assert.Empty(t, lookup(w.tenant(t, "x-b", "XTB"), u), "not a member there")

	testdb.Exec(t, w.tx, `UPDATE memberships SET is_owner = false WHERE id = $1`, m)
	testdb.Exec(t, w.tx, `UPDATE memberships SET status = 'disabled', disabled_at = now() WHERE id = $1`, m)
	assert.Empty(t, lookup(a, u), "a disabled membership is not access")
}

func TestFeatureTheSwitcherListsActiveMemberships(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	c := w.tenant(t, "x-c", "XTC")
	w.platformDomain(t, a, "a.x-tenancy.test", "workspace", true)
	u := w.user(t, 1)
	w.member(t, a, u, false)
	w.member(t, b, u, true)
	w.invite(t, c, u)

	type entry struct {
		TenantCode    string
		IsOwner       bool
		WorkspaceHost *string
	}
	rows, err := w.tx.Query(t.Context(), `SELECT tenant_code, is_owner, workspace_host FROM lookup.memberships_of($1)`, u)
	require.NoError(t, err)
	got, err := pgx.CollectRows(rows, pgx.RowToStructByPos[entry])
	require.NoError(t, err)
	host := "a.x-tenancy.test"
	assert.Equal(t, []entry{
		{TenantCode: "XTA", WorkspaceHost: &host},
		{TenantCode: "XTB", IsOwner: true}, // no workspace host yet
	}, got, "active memberships only, by tenant name")
}

// The lookups run as the runtime role before any tenant is set.
func TestFeatureTheRuntimeRoleCallsTheMembershipLookups(t *testing.T) {
	tx := testdb.Tx(t)
	var n int
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT count(*) FROM lookup.active_membership(
		'0192f6a0-0000-7000-8000-000000000000', '0192f6a0-0000-7000-8000-000000000000')`).Scan(&n))
	assert.Zero(t, n)
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT count(*) FROM lookup.memberships_of('0192f6a0-0000-7000-8000-000000000000')`).Scan(&n))
	assert.Zero(t, n)
}

func TestFeatureMembershipPolicies(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	owner := w.user(t, 1)
	staff := w.user(t, 2)
	opStaff := w.user(t, 3)
	newcomer := w.user(t, 4)
	w.member(t, a, owner, true)
	w.member(t, a, staff, false)
	w.member(t, b, w.user(t, 5), false)
	w.member(t, op, opStaff, false)
	testdb.Exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	testdb.Exec(t, w.tx, `ALTER TABLE memberships FORCE ROW LEVEL SECURITY`)

	visible := func() int {
		var n int
		require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM memberships m
			JOIN tenants t ON t.id = m.tenant_id WHERE t.code LIKE 'X%'`).Scan(&n))
		return n
	}
	// tenants is not forced, so the join above sees every tenant; memberships is.
	w.as(t, "")
	assert.Zero(t, visible(), "no tenant: nothing")

	w.as(t, a)
	assert.Equal(t, 2, visible(), "a tenant sees its own memberships")
	_, err := testdb.Savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, $2, now())`, a, newcomer)
	require.NoError(t, err, "a tenant invites into itself")
	_, err = testdb.Savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, $2, now())`, b, newcomer)
	assert.Equal(t, "42501", testdb.PgCode(err), "but not into another tenant")

	w.as(t, op)
	assert.Equal(t, 3, visible(), "the operator sees its own members, other tenants' owners, and their invitations")
	_, err = testdb.Savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at, is_owner)
		VALUES ($1, $2, now(), true)`, b, newcomer)
	require.NoError(t, err, "the operator creates an owner membership")
	_, err = testdb.Savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, $2, now())`, a, opStaff)
	require.NoError(t, err, "and invites a tenant's administrators (C228)")
	_, err = testdb.Savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, $2, 'active', now())`, a, opStaff)
	assert.Equal(t, "42501", testdb.PgCode(err), "but makes no one an active member of another tenant")
	tag, err := testdb.Savepoint(t, w.tx, `UPDATE memberships SET status = 'disabled', disabled_at = now() WHERE user_id = $1`, staff)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor changes one")
	tag, err = testdb.Savepoint(t, w.tx, `DELETE FROM memberships WHERE user_id = $1`, opStaff)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no one deletes a membership: it is ended")
}

// An invitation names an e-mail and waits on it until an account verifies it (C230): then it
// is claimed, its user set once.
func TestFeatureAnInvitationWaitsOnAnAddressUntilItIsClaimed(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	u := w.user(t, 1)
	v := w.user(t, 2)
	invite := `INSERT INTO memberships (tenant_id, invite_email, invite_name) VALUES ($1, 'ali@x-tenancy.test', 'Ali') RETURNING id`
	m := testdb.ID(t, w.tx, invite, a)
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": m, "user_id": nil, "status": "invited", "invite_expires_at": nil})
	_, err := testdb.Savepoint(t, w.tx, invite, a)
	assert.Equal(t, "23505", testdb.PgCode(err), "one live invitation per address and tenant")

	testdb.Exec(t, w.tx, `UPDATE memberships SET user_id = $1, status = 'active', joined_at = now() WHERE id = $2`, u, m)
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": m, "user_id": u, "invite_email": "ali@x-tenancy.test"})
	_, err = testdb.Savepoint(t, w.tx, `UPDATE memberships SET user_id = $1 WHERE id = $2`, v, m)
	assert.Equal(t, "23514", testdb.PgCode(err), "claimed once: its user never changes")
	testdb.ID(t, w.tx, invite, a) // claimed, so the address may be invited again
}

// The operator sees other tenants' invitations and owners only: after the hand-over an
// active member who is not an owner is the tenant's alone (C228).
func TestFeatureTheOperatorSeesOnlyInvitationsAndOwnersElsewhere(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	w.member(t, a, w.user(t, 1), true)
	staff := w.member(t, a, w.user(t, 2), false)
	invited := testdb.ID(t, w.tx, `INSERT INTO memberships (tenant_id, invite_email, invite_name) VALUES ($1, 'ali@x-tenancy.test', 'Ali') RETURNING id`, a)
	testdb.Exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	testdb.Exec(t, w.tx, `ALTER TABLE memberships FORCE ROW LEVEL SECURITY`)
	w.as(t, op)

	var ids []string
	rows, err := w.tx.Query(t.Context(), `SELECT id::text FROM memberships WHERE tenant_id = $1`, a)
	require.NoError(t, err)
	ids, err = pgx.CollectRows(rows, pgx.RowTo[string])
	require.NoError(t, err)
	assert.Len(t, ids, 2, "the owner and the invitation")
	assert.NotContains(t, ids, staff)

	tag, err := testdb.Savepoint(t, w.tx, `UPDATE memberships SET status = 'ended', ended_at = now() WHERE id = $1`, invited)
	require.NoError(t, err)
	assert.Equal(t, int64(1), tag.RowsAffected(), "the operator cancels an invitation")
}
