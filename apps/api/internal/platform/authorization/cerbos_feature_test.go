//go:build feature

package authorization_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
)

// These tests ask the real Cerbos, loaded with the edition's real policies
// (.github/scripts/start-cerbos.sh), through the adapter as the API uses it.

func cerbosAddr(t *testing.T) string {
	t.Helper()
	addr := os.Getenv("CERBOS_TEST_ADDR")
	if addr == "" {
		t.Fatal("CERBOS_TEST_ADDR is not set; feature tests need Cerbos (see docs/testing.md)")
	}
	return addr
}

func authorizer(t *testing.T, addr string, who authorization.Principal) *authorization.Cerbos {
	t.Helper()
	client, err := authorization.Dial(authorization.Settings{Addr: addr, Timeout: 2 * time.Second})
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.Close() })
	return authorization.NewCerbos(client, func(context.Context) (authorization.Principal, error) { return who, nil }, 2*time.Second)
}

const (
	shifau   = "0192f6a0-0000-7000-8000-00000000a001"
	mariyam  = "0192f6a0-0000-7000-8000-00000000a002"
	tenantA  = "0192f6a0-0000-7000-8000-0000000000aa"
	operator = "0192f6a0-0000-7000-8000-0000000000bb"
)

func TestFeatureAPersonSeesOnlyTheirOwnUser(t *testing.T) {
	a := authorizer(t, cerbosAddr(t), authorization.Principal{ID: shifau, Roles: []string{"user"}})
	require.NoError(t, a.Check(t.Context(), "view", authorization.Resource{Kind: "identity:user", ID: shifau}))
	assert.ErrorIs(t, a.Check(t.Context(), "view", authorization.Resource{Kind: "identity:user", ID: mariyam}), authorization.ErrDenied)
	assert.ErrorIs(t, a.Check(t.Context(), "update", authorization.Resource{Kind: "identity:user", ID: shifau}), authorization.ErrDenied)
}

func TestFeatureAClientSeesItselfWithinATenantOrNot(t *testing.T) {
	addr := cerbosAddr(t)
	for name, attrs := range map[string]map[string]any{
		"no tenant": nil,
		"tenant":    {"tenant_id": tenantA, "in_operator_tenant": false},
	} {
		a := authorizer(t, addr, authorization.Principal{ID: "hrms-sync", Roles: []string{"client"}, Attributes: attrs})
		assert.NoError(t, a.Check(t.Context(), "view", authorization.Resource{Kind: "identity:client", ID: "hrms-sync"}), name)
		assert.ErrorIs(t, a.Check(t.Context(), "view", authorization.Resource{Kind: "identity:user", ID: "hrms-sync"}),
			authorization.ErrDenied, name+": a client is never a user")
	}
}

func TestFeatureAMissingOrUndeclaredAttributeIsABug(t *testing.T) {
	addr := cerbosAddr(t)
	lonely := authorizer(t, addr, authorization.Principal{ID: "hrms-sync", Roles: []string{"client"},
		Attributes: map[string]any{"tenant_id": tenantA}})
	assert.ErrorIs(t, lonely.Check(t.Context(), "view", authorization.Resource{Kind: "identity:client", ID: "hrms-sync"}),
		authorization.ErrInvalid, "tenant_id without in_operator_tenant")

	person := authorizer(t, addr, authorization.Principal{ID: shifau, Roles: []string{"user"}})
	err := person.Check(t.Context(), "view", authorization.Resource{Kind: "identity:user", ID: shifau},
		authorization.Facts(map[string]any{"email": "shifau@bool.mv"}))
	require.ErrorIs(t, err, authorization.ErrInvalid, "an undeclared fact is refused, not sent on")
	assert.NotContains(t, err.Error(), "shifau@bool.mv", "the error names the attribute, never its value")
}

func TestFeatureCanUsesThePlanner(t *testing.T) {
	addr := cerbosAddr(t)
	staff := authorizer(t, addr, authorization.Principal{ID: shifau, Roles: []string{"member", "tenancy:tenant:view"},
		Attributes: map[string]any{"tenant_id": operator, "in_operator_tenant": true}})
	require.NoError(t, staff.Can(t.Context(), "list", "tenancy:tenant"), "operator staff list tenants")

	member := authorizer(t, addr, authorization.Principal{ID: mariyam, Roles: []string{"member"},
		Attributes: map[string]any{"tenant_id": tenantA, "in_operator_tenant": false}})
	assert.ErrorIs(t, member.Can(t.Context(), "list", "tenancy:tenant"), authorization.ErrDenied)
	require.NoError(t, member.Can(t.Context(), "view", "tenancy:tenant"), "a member may view some tenant: their own")
	require.NoError(t, member.Check(t.Context(), "view", authorization.Resource{Kind: "tenancy:tenant", ID: tenantA,
		Attributes: map[string]any{"tenant_id": tenantA, "status": "active"}}))
}

// GET /api/v1/tenant (C162): the principal the edition builds for a person in a
// tenant, with member only when RequireMember found their membership.
func TestFeatureAMemberViewsOnlyTheirOwnTenant(t *testing.T) {
	addr := cerbosAddr(t)
	attrs := map[string]any{"account_id": "0192f6a0-0000-7000-8000-0000000ac001", "tenant_id": tenantA, "in_operator_tenant": false}
	tenant := func(id string) authorization.Resource {
		return authorization.Resource{Kind: "tenancy:tenant", ID: id, Attributes: map[string]any{"tenant_id": id, "status": "active"}}
	}

	member := authorizer(t, addr, authorization.Principal{ID: shifau, Roles: []string{"user", "member"}, Attributes: attrs})
	require.NoError(t, member.Check(t.Context(), "view", tenant(tenantA)))
	assert.ErrorIs(t, member.Check(t.Context(), "view", tenant(operator)), authorization.ErrDenied)

	outsider := authorizer(t, addr, authorization.Principal{ID: shifau, Roles: []string{"user"}, Attributes: attrs})
	assert.ErrorIs(t, outsider.Check(t.Context(), "view", tenant(tenantA)), authorization.ErrDenied, "not a member")
}

func TestFeatureAnUnreachableCerbosRefuses(t *testing.T) {
	a := authorizer(t, "127.0.0.1:1", authorization.Principal{ID: shifau, Roles: []string{"user"}})
	start := time.Now()
	err := a.Check(context.Background(), "view", authorization.Resource{Kind: "identity:user", ID: shifau})
	assert.ErrorIs(t, err, authorization.ErrUnavailable)
	assert.Less(t, time.Since(start), 5*time.Second, "bounded by the timeout")
	assert.ErrorIs(t, a.Can(context.Background(), "list", "tenancy:tenant"), authorization.ErrUnavailable)
}
