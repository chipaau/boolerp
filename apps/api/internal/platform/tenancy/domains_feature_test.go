//go:build feature

package tenancy_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Hosts in these tests end in .x-tenancy.test, a name no real domain uses.

// token is a valid verification token (32 or more URL-safe characters).
const token = "abcdefghijklmnopqrstuvwxyz012345"

// platformDomain adds an active platform host for tenant and returns its id.
func (w *world) platformDomain(t *testing.T, tenant, host, serves string, primary bool) string {
	t.Helper()
	return id(t, w.tx, `INSERT INTO domains (tenant_id, host, kind, serves, status, activated_at, is_primary)
		VALUES ($1, $2, 'platform', $3, 'active', now(), $4) RETURNING id`, tenant, host, serves, primary)
}

// customDomain adds a pending custom host for tenant and returns its id.
func (w *world) customDomain(t *testing.T, tenant, host string) string {
	t.Helper()
	return id(t, w.tx, `INSERT INTO domains (tenant_id, host, kind, verification_token)
		VALUES ($1, $2, 'custom', $3) RETURNING id`, tenant, host, token)
}

type lookup struct {
	TenantID, TenantCode, TenantStatus string
	IsOperator                         bool
	Serves                             string
}

// lookupHost calls the request lookup and returns its rows.
func lookupHost(t *testing.T, tx pgx.Tx, host string) []lookup {
	t.Helper()
	rows, err := tx.Query(t.Context(), `SELECT tenant_id::text, tenant_code, tenant_status, is_operator, serves
		FROM lookup.tenant_by_host($1)`, host)
	require.NoError(t, err)
	found, err := pgx.CollectRows(rows, pgx.RowToStructByPos[lookup])
	require.NoError(t, err)
	return found
}

func TestFeatureATenantHasPlatformAndCustomHosts(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	w.platformDomain(t, a, "a.x-tenancy.test", "workspace", true)
	custom := w.customDomain(t, a, "workspace.a.x-tenancy.test")
	w.customDomain(t, a, "portal.a.x-tenancy.test")
	exec(t, w.tx, `UPDATE domains SET serves = 'academics.student' WHERE host = 'portal.a.x-tenancy.test'`)

	// Verified, the custom host becomes active; the primary moves to it.
	exec(t, w.tx, `UPDATE domains SET status = 'active', verified_at = now(), activated_at = now() WHERE id = $1`, custom)
	exec(t, w.tx, `UPDATE domains SET is_primary = false WHERE tenant_id = $1 AND serves = 'workspace'`, a)
	exec(t, w.tx, `UPDATE domains SET is_primary = true WHERE id = $1`, custom)

	assert.Equal(t, 3, testdb.Count(t, w.tx, "domains", map[string]any{"tenant_id": a}))
	testdb.AssertHas(t, w.tx, "domains", map[string]any{"id": custom, "is_primary": true})
}

func TestFeatureDomainConstraints(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	w.platformDomain(t, a, "a.x-tenancy.test", "workspace", true)

	for name, sql := range map[string]string{
		"uppercase host":           `INSERT INTO domains (tenant_id, host, kind, status, activated_at) VALUES ($1, 'B.x-tenancy.test', 'platform', 'active', now())`,
		"host with a port":         `INSERT INTO domains (tenant_id, host, kind, status, activated_at) VALUES ($1, 'b.x-tenancy.test:443', 'platform', 'active', now())`,
		"host with a trailing dot": `INSERT INTO domains (tenant_id, host, kind, status, activated_at) VALUES ($1, 'b.x-tenancy.test.', 'platform', 'active', now())`,
		"single label":             `INSERT INTO domains (tenant_id, host, kind, status, activated_at) VALUES ($1, 'localhost', 'platform', 'active', now())`,
		"label ending in a hyphen": `INSERT INTO domains (tenant_id, host, kind, status, activated_at) VALUES ($1, 'b-.x-tenancy.test', 'platform', 'active', now())`,
		"unknown kind":             `INSERT INTO domains (tenant_id, host, kind) VALUES ($1, 'b.x-tenancy.test', 'other')`,
		"bad portal key":           `INSERT INTO domains (tenant_id, host, kind, serves, status, activated_at) VALUES ($1, 'b.x-tenancy.test', 'platform', 'Student Portal', 'active', now())`,
		"custom without a token":   `INSERT INTO domains (tenant_id, host, kind) VALUES ($1, 'b.x-tenancy.test', 'custom')`,
		"platform with a token":    `INSERT INTO domains (tenant_id, host, kind, verification_token) VALUES ($1, 'b.x-tenancy.test', 'platform', '` + token + `')`,
		"short token":              `INSERT INTO domains (tenant_id, host, kind, verification_token) VALUES ($1, 'b.x-tenancy.test', 'custom', 'short')`,
		"active without the time":  `INSERT INTO domains (tenant_id, host, kind, status) VALUES ($1, 'b.x-tenancy.test', 'platform', 'active')`,
		"active custom unverified": `INSERT INTO domains (tenant_id, host, kind, verification_token, status, activated_at) VALUES ($1, 'b.x-tenancy.test', 'custom', '` + token + `', 'active', now())`,
		"revoked without the time": `INSERT INTO domains (tenant_id, host, kind, status) VALUES ($1, 'b.x-tenancy.test', 'platform', 'revoked')`,
		"pending primary":          `INSERT INTO domains (tenant_id, host, kind, verification_token, is_primary) VALUES ($1, 'b.x-tenancy.test', 'custom', '` + token + `', true)`,
		"second primary":           `INSERT INTO domains (tenant_id, host, kind, status, activated_at, is_primary) VALUES ($1, 'b.x-tenancy.test', 'platform', 'active', now(), true)`,
		"taken host":               `INSERT INTO domains (tenant_id, host, kind, verification_token) VALUES ($1, 'a.x-tenancy.test', 'custom', '` + token + `')`,
	} {
		_, err := savepoint(t, w.tx, sql, a)
		assert.Error(t, err, name)
	}
}

func TestFeatureAPrimaryPerThingServed(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	w.platformDomain(t, a, "a.x-tenancy.test", "workspace", true)
	w.platformDomain(t, a, "students-a.x-tenancy.test", "academics.student", true)
	assert.Equal(t, 2, testdb.Count(t, w.tx, "domains", map[string]any{"tenant_id": a, "is_primary": true}))
}

func TestFeatureARevokedHostCanBeClaimedAgain(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	old := w.customDomain(t, a, "erp.x-tenancy.test")
	exec(t, w.tx, `UPDATE domains SET status = 'revoked', revoked_at = now() WHERE id = $1`, old)

	w.customDomain(t, b, "erp.x-tenancy.test")
	assert.Equal(t, 2, testdb.Count(t, w.tx, "domains", map[string]any{"host": "erp.x-tenancy.test"}))
}

func TestFeatureADomainsHostKindAndTenantNeverChange(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	d := w.customDomain(t, a, "c.x-tenancy.test")

	for name, sql := range map[string]string{
		"host":   `UPDATE domains SET host = 'other.x-tenancy.test' WHERE id = $1`,
		"kind":   `UPDATE domains SET kind = 'platform', verification_token = null WHERE id = $1`,
		"tenant": `UPDATE domains SET tenant_id = '` + b + `' WHERE id = $1`,
	} {
		_, err := savepoint(t, w.tx, sql, d)
		assert.Equal(t, "23514", code(t, err), name)
	}
}

func TestFeatureDomainUpdatedAtFollowsChanges(t *testing.T) {
	w := newWorld(t)
	a := w.tenant(t, "x-a", "XTA")
	d := id(t, w.tx, `INSERT INTO domains (tenant_id, host, kind, verification_token, updated_at)
		VALUES ($1, 'c.x-tenancy.test', 'custom', $2, '2000-01-01') RETURNING id`, a, token)
	exec(t, w.tx, `UPDATE domains SET serves = 'academics.student' WHERE id = $1`, d)
	var setToNow bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT updated_at = now() FROM domains WHERE id = $1`, d).Scan(&setToNow))
	assert.True(t, setToNow)
}

func TestFeatureLookupFindsOnlyActiveHosts(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	w.platformDomain(t, op, "workspace.x-tenancy.test", "workspace", true)
	w.platformDomain(t, a, "a.x-tenancy.test", "workspace", true)
	w.platformDomain(t, a, "students-a.x-tenancy.test", "academics.student", true)
	w.customDomain(t, a, "pending.x-tenancy.test")
	revoked := w.customDomain(t, a, "revoked.x-tenancy.test")
	exec(t, w.tx, `UPDATE domains SET status = 'revoked', revoked_at = now() WHERE id = $1`, revoked)

	assert.Equal(t, []lookup{{TenantID: a, TenantCode: "XTA", TenantStatus: "provisioning", Serves: "workspace"}},
		lookupHost(t, w.tx, "a.x-tenancy.test"))
	assert.Equal(t, []lookup{{TenantID: a, TenantCode: "XTA", TenantStatus: "provisioning", Serves: "academics.student"}},
		lookupHost(t, w.tx, "students-a.x-tenancy.test"))
	assert.Equal(t, []lookup{{TenantID: op, TenantCode: "XOP", TenantStatus: "provisioning", IsOperator: true, Serves: "workspace"}},
		lookupHost(t, w.tx, "workspace.x-tenancy.test"))
	for _, host := range []string{"pending.x-tenancy.test", "revoked.x-tenancy.test", "unknown.x-tenancy.test", "A.X-TENANCY.TEST"} {
		assert.Empty(t, lookupHost(t, w.tx, host), host)
	}
}

// The lookup runs before any tenant is known, as the runtime role: it must not
// need a tenant, and must work past row-level security.
func TestFeatureTheRuntimeRoleCallsTheLookup(t *testing.T) {
	assert.Empty(t, lookupHost(t, testdb.Tx(t), "nothing-here.x-tenancy.test"))
}

func TestFeatureDomainPolicies(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	w.platformDomain(t, a, "a.x-tenancy.test", "workspace", true)
	w.platformDomain(t, b, "b.x-tenancy.test", "workspace", true)
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`)
	exec(t, w.tx, `ALTER TABLE domains FORCE ROW LEVEL SECURITY`)

	hosts := func() []string {
		rows, err := w.tx.Query(t.Context(), `SELECT host FROM domains WHERE host LIKE '%.x-tenancy.test' ORDER BY host`)
		require.NoError(t, err)
		found, err := pgx.CollectRows(rows, pgx.RowTo[string])
		require.NoError(t, err)
		return found
	}

	w.as(t, "")
	assert.Empty(t, hosts(), "no tenant: nothing")

	w.as(t, a)
	assert.Equal(t, []string{"a.x-tenancy.test"}, hosts(), "a tenant sees its own domains")
	_, err := savepoint(t, w.tx, `INSERT INTO domains (tenant_id, host, kind, verification_token)
		VALUES ($1, 'mine.x-tenancy.test', 'custom', $2)`, a, token)
	assert.Equal(t, "42501", code(t, err), "a tenant does not add domains")
	tag, err := savepoint(t, w.tx, `UPDATE domains SET serves = 'academics.student' WHERE host = 'a.x-tenancy.test'`)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor changes them")

	w.as(t, op)
	assert.Equal(t, []string{"a.x-tenancy.test", "b.x-tenancy.test"}, hosts(), "the operator sees every domain")
	_, err = savepoint(t, w.tx, `INSERT INTO domains (tenant_id, host, kind, verification_token)
		VALUES ($1, 'new.x-tenancy.test', 'custom', $2)`, b, token)
	require.NoError(t, err, "the operator adds domains")
	tag, err = savepoint(t, w.tx, `DELETE FROM domains WHERE host = 'b.x-tenancy.test'`)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no one deletes a domain: it is revoked")
}
