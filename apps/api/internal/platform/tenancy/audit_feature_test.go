//go:build feature

package tenancy_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// audit_log's read policy (C147, C164) through tenancy's tables: a tenant reads its own
// rows, the operator tenant every row. Here because only tenancy's tests create the
// operator. The migration role is not audit_log's owner, so the policy applies to it.
func TestFeatureTheOperatorReadsEveryTenantsAudit(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	w.platformDomain(t, a, "a.x-tenancy.test", "workspace", true)

	auditOfA := func(acting string) int {
		w.as(t, acting)
		var n int
		require.NoError(t, w.tx.QueryRow(t.Context(),
			`SELECT count(*) FROM audit_log WHERE tenant_id = $1 AND entity IN ('tenants', 'domains')`, a).Scan(&n))
		return n
	}
	assert.Equal(t, 2, auditOfA(a), "A reads its own: its tenant row and its domain")
	assert.Equal(t, 0, auditOfA(b), "B reads none of A's")
	assert.Equal(t, 2, auditOfA(op), "the operator reads every tenant's")
	assert.Equal(t, 0, auditOfA(""), "no tenant: nothing")
}
