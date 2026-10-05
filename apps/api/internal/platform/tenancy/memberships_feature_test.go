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
	return id(t, w.tx, `INSERT INTO users (kratos_identity_id, email, phone) VALUES ($1, $2, '+9990000000') RETURNING id`,
		fmt.Sprintf("0192f6a0-0000-7000-8000-00000e%06d", n), fmt.Sprintf("member%d@x-tenancy.test", n))
}

// member adds an active membership and returns its id.
func (w *world) member(t *testing.T, tenant, user string, owner bool) string {
	t.Helper()
	return id(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at, is_owner)
		VALUES ($1, $2, 'active', now(), $3) RETURNING id`, tenant, user, owner)
}

// invite adds an invited membership and returns its id.
func (w *world) invite(t *testing.T, tenant, user string) string {
	t.Helper()
	return id(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at)
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
		"second live membership":    `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, '` + u + `', now())`,
		"second owner":              `INSERT INTO memberships (tenant_id, user_id, status, joined_at, is_owner) VALUES ($1, '` + v + `', 'active', now(), true)`,
		"unknown status":            `INSERT INTO memberships (tenant_id, user_id, status) VALUES ($1, '` + v + `', 'pending')`,
		"invited without expiry":    `INSERT INTO memberships (tenant_id, user_id) VALUES ($1, '` + v + `')`,
		"active without joining":    `INSERT INTO memberships (tenant_id, user_id, status) VALUES ($1, '` + v + `', 'active')`,
		"disabled without the time": `INSERT INTO memberships (tenant_id, user_id, status, joined_at) VALUES ($1, '` + v + `', 'disabled', now())`,
		"ended without the time":    `INSERT INTO memberships (tenant_id, user_id, status) VALUES ($1, '` + v + `', 'ended')`,
		"disabled owner":            `INSERT INTO memberships (tenant_id, user_id, status, joined_at, disabled_at, is_owner) VALUES ($1, '` + v + `', 'disabled', now(), now(), true)`,
		"unknown user":              `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, '0192f6a0-0000-7000-8000-000000000000', now())`,
	} {
		_, err := savepoint(t, w.tx, sql, a)
		assert.Error(t, err, name)
	}
}

func TestFeatureAnEndedMembershipIsHistory(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	u := w.user(t, 1)
	first := w.member(t, a, u, false)
	exec(t, w.tx, `UPDATE memberships SET status = 'ended', ended_at = now() WHERE id = $1`, first)

	// Rejoining is a new row; the ended one is frozen.
	w.invite(t, a, u)
	assert.Equal(t, 2, testdb.Count(t, w.tx, "memberships", map[string]any{"tenant_id": a, "user_id": u}))
	_, err := savepoint(t, w.tx, `UPDATE memberships SET status = 'active', ended_at = null WHERE id = $1`, first)
	assert.Equal(t, "23514", code(t, err), "an ended membership cannot change")
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
		_, err := savepoint(t, w.tx, sql, m)
		assert.Equal(t, "23514", code(t, err), name)
	}
}

func TestFeatureDisablingIsReversible(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	m := w.member(t, a, w.user(t, 1), false)
	exec(t, w.tx, `UPDATE memberships SET status = 'disabled', disabled_at = now() WHERE id = $1`, m)
	exec(t, w.tx, `UPDATE memberships SET status = 'active', disabled_at = null WHERE id = $1`, m)
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": m, "status": "active"})
}

func TestFeatureTheOwnerCanBeTransferred(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	old := w.member(t, a, w.user(t, 1), true)
	next := w.member(t, a, w.user(t, 2), false)
	exec(t, w.tx, `UPDATE memberships SET is_owner = false WHERE id = $1`, old)
	exec(t, w.tx, `UPDATE memberships SET is_owner = true WHERE id = $1`, next)
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"id": next, "is_owner": true})
}

func TestFeatureMembershipUpdatedAtFollowsChanges(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	m := id(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at, updated_at)
		VALUES ($1, $2, now(), '2000-01-01') RETURNING id`, a, w.user(t, 1))
	exec(t, w.tx, `UPDATE memberships SET invite_expires_at = now() + interval '1 day' WHERE id = $1`, m)
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

	exec(t, w.tx, `UPDATE memberships SET is_owner = false WHERE id = $1`, m)
	exec(t, w.tx, `UPDATE memberships SET status = 'disabled', disabled_at = now() WHERE id = $1`, m)
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
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	exec(t, w.tx, `ALTER TABLE memberships FORCE ROW LEVEL SECURITY`)

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
	_, err := savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, $2, now())`, a, newcomer)
	require.NoError(t, err, "a tenant invites into itself")
	_, err = savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, $2, now())`, b, newcomer)
	assert.Equal(t, "42501", code(t, err), "but not into another tenant")

	w.as(t, op)
	assert.Equal(t, 2, visible(), "the operator sees its own members and other tenants' owners")
	_, err = savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at, is_owner)
		VALUES ($1, $2, now(), true)`, b, newcomer)
	require.NoError(t, err, "the operator creates an owner membership")
	_, err = savepoint(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, invite_expires_at) VALUES ($1, $2, now())`, a, opStaff)
	assert.Equal(t, "42501", code(t, err), "but no other membership in another tenant")
	tag, err := savepoint(t, w.tx, `UPDATE memberships SET status = 'disabled', disabled_at = now() WHERE user_id = $1`, staff)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor changes one")
	tag, err = savepoint(t, w.tx, `DELETE FROM memberships WHERE user_id = $1`, opStaff)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no one deletes a membership: it is ended")
}
