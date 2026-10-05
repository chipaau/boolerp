//go:build feature

package tenancy_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
)

// The membership seeders' tests live here with the operator seeder's: they create
// the one operator.

func TestFeatureTheOperatorMembersSeederAddsTheTeam(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	u1, u2 := w.user(t, 1), w.user(t, 2)
	s := seeds.NewOperatorMembers(w.tx, []seeds.Member{
		{Email: "MEMBER1@x-tenancy.test", Owner: true}, // emails match in any case
		{Email: "member2@x-tenancy.test"},
	})
	assert.Equal(t, "tenancy.operator_members", s.Name())
	require.NoError(t, s.Run(t.Context(), seedEnvFor("prod")))
	require.NoError(t, s.Run(t.Context(), seedEnvFor("prod")), "running again is fine")

	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": op, "user_id": u1, "status": "active", "is_owner": true})
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": op, "user_id": u2, "status": "active", "is_owner": false})
	assert.Equal(t, 2, testdb.Count(t, w.tx, "memberships", map[string]any{"tenant_id": op}), "running again never duplicates")
	var joined bool
	require.NoError(t, w.tx.QueryRow(t.Context(),
		`SELECT bool_and(joined_at IS NOT NULL AND invited_by IS NULL) FROM memberships WHERE tenant_id = $1`, op).Scan(&joined))
	assert.True(t, joined, "joined now, invited by nobody")
}

func TestFeatureTheOperatorMembersSeederLeavesLaterChanges(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	u1, u2, u3 := w.user(t, 1), w.user(t, 2), w.user(t, 3)
	w.member(t, op, u3, true) // the owner was transferred to someone else
	exec(t, w.tx, `INSERT INTO memberships (tenant_id, user_id, status, joined_at, disabled_at)
		VALUES ($1, $2, 'disabled', now(), now())`, op, u2) // and a member paused
	require.NoError(t, seeds.NewOperatorMembers(w.tx, []seeds.Member{
		{Email: "member1@x-tenancy.test", Owner: true}, {Email: "member2@x-tenancy.test"},
	}).Run(t.Context(), seedEnvFor("prod")))

	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": op, "user_id": u1, "status": "active", "is_owner": false})
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": op, "user_id": u2, "status": "disabled"})
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": op, "user_id": u3, "is_owner": true})
	assert.Equal(t, 1, testdb.Count(t, w.tx, "memberships", map[string]any{"tenant_id": op, "user_id": u2}))
}

func TestFeatureTheOperatorMembersSeederNeedsTheOperatorAndTheUsers(t *testing.T) {
	w := newWorld(t)
	w.user(t, 1)
	members := []seeds.Member{{Email: "member1@x-tenancy.test"}}
	require.ErrorContains(t, seeds.NewOperatorMembers(w.tx, members).Run(t.Context(), seedEnv()), "find the operator")

	w.operator(t)
	err := seeds.NewOperatorMembers(w.tx, []seeds.Member{{Email: "nobody@x-tenancy.test"}}).Run(t.Context(), seedEnv())
	require.ErrorContains(t, err, "no user")
	assert.NotContains(t, err.Error(), "nobody@", "the email is personal data")
}

func TestFeatureTheSampleMembersSeederAddsTheTeamToEverySample(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	require.NoError(t, seeds.NewSamplesFrom(w.tx, []byte(testSamples), "x-tenancy.test").Run(t.Context(), seedEnvFor("dev")))
	u1, u2, u3 := w.user(t, 1), w.user(t, 2), w.user(t, 3)
	s := seeds.NewSampleMembersFrom(w.tx, []byte(testSamples),
		[]seeds.Member{{Email: "member1@x-tenancy.test", Owner: true}, {Email: "member2@x-tenancy.test"}},
		seeds.Grant{Tenant: "x-company", Member: seeds.Member{Email: "member3@x-tenancy.test"}})
	assert.Equal(t, "tenancy.sample_members", s.Name())
	require.NoError(t, s.Run(t.Context(), seedEnvFor("dev")))
	require.NoError(t, s.Run(t.Context(), seedEnvFor("dev")), "running again is fine")

	for _, slug := range []string{"x-ministry", "x-hospital", "x-company", "x-new"} {
		tenant := id(t, w.tx, `SELECT id FROM tenants WHERE slug = $1`, slug)
		testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": tenant, "user_id": u1, "status": "active", "is_owner": true})
		testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": tenant, "user_id": u2, "status": "active", "is_owner": false})
	}
	company := id(t, w.tx, `SELECT id FROM tenants WHERE slug = 'x-company'`)
	testdb.AssertHas(t, w.tx, "memberships", map[string]any{"tenant_id": company, "user_id": u3, "status": "active", "is_owner": false})
	assert.Equal(t, 1, testdb.Count(t, w.tx, "memberships", map[string]any{"user_id": u3}), "the extra grant only")
	assert.Equal(t, 4, testdb.Count(t, w.tx, "memberships", map[string]any{"user_id": u1}), "running again never duplicates")
}

func TestFeatureTheSampleMembersSeederRunsOnlyInDev(t *testing.T) {
	w := newWorld(t)
	u1 := w.user(t, 1)
	require.NoError(t, seeds.NewSampleMembersFrom(w.tx, []byte(testSamples),
		[]seeds.Member{{Email: "member1@x-tenancy.test"}}).Run(t.Context(), seedEnvFor("staging")))
	testdb.AssertMissing(t, w.tx, "memberships", map[string]any{"user_id": u1})
}

func TestFeatureTheSampleMembersSeederNeedsTheSamples(t *testing.T) {
	w := newWorld(t)
	w.user(t, 1)
	err := seeds.NewSampleMembersFrom(w.tx, []byte(testSamples),
		[]seeds.Member{{Email: "member1@x-tenancy.test"}}).Run(t.Context(), seedEnvFor("dev"))
	require.ErrorContains(t, err, "sample member of x-ministry")
	require.Error(t, seeds.NewSampleMembersFrom(w.tx, []byte("not,a,list\n"), nil).Run(t.Context(), seedEnvFor("dev")))
}
