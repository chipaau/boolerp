package tenancy

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/auth"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// fakeLookups stands in for the database lookups: hosts and memberships by
// tenant and user, or err for every call.
type fakeLookups struct {
	hosts   map[string]store.Host
	members map[string]tenant.Membership // tenantID + "/" + userID
	err     error
	asked   []string
}

func (f *fakeLookups) TenantByHost(_ context.Context, host string) (store.Host, bool, error) {
	f.asked = append(f.asked, host)
	h, ok := f.hosts[host]
	return h, ok, f.err
}

func (f *fakeLookups) ActiveMembership(_ context.Context, tenantID, userID string) (tenant.Membership, bool, error) {
	m, ok := f.members[tenantID+"/"+userID]
	return m, ok, f.err
}

var (
	cityTenant = tenant.Tenant{ID: "t-city", Code: "MCC", Status: "active"}
	lookups    = func() *fakeLookups {
		return &fakeLookups{
			hosts: map[string]store.Host{
				"male-city.bool.test": {Tenant: cityTenant, Serves: "workspace"},
				"portal.bool.test":    {Tenant: cityTenant, Serves: "academics.student"},
			},
			members: map[string]tenant.Membership{"t-city/u-member": {ID: "m-1", IsOwner: true}},
		}
	}
)

// seen records what a handler behind the middleware found in its context.
type seen struct {
	tenant     tenant.Tenant
	membership tenant.Membership
	called     bool
}

func (s *seen) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.called = true
		s.tenant, _ = tenant.From(r.Context())
		s.membership, _ = tenant.MembershipFrom(r.Context())
		w.WriteHeader(http.StatusNoContent)
	})
}

func module(l *fakeLookups) *Module {
	return &Module{lookups: l, logger: slog.New(slog.DiscardHandler)}
}

func TestResolveTenantFromTheHost(t *testing.T) {
	for name, c := range map[string]struct {
		host string
		want int
	}{
		"a workspace host":                 {"male-city.bool.test", http.StatusNoContent},
		"in another case, with a port":     {"Male-City.Bool.Test:8080", http.StatusNoContent},
		"with a trailing dot":              {"male-city.bool.test.", http.StatusNoContent},
		"a portal host opens no workspace": {"portal.bool.test", http.StatusNotFound},
		"an unknown host":                  {"nowhere.bool.test", http.StatusNotFound},
		"no host":                          {"", http.StatusNotFound},
	} {
		t.Run(name, func(t *testing.T) {
			var s seen
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.Host = c.host
			rec := httptest.NewRecorder()
			module(lookups()).ResolveTenant(s.handler()).ServeHTTP(rec, r)
			assert.Equal(t, c.want, rec.Code)
			if c.want == http.StatusNoContent {
				assert.Equal(t, cityTenant, s.tenant)
			} else {
				assert.False(t, s.called)
				assert.Equal(t, notFound, detail(t, rec))
			}
		})
	}
}

func TestResolveTenantWhenTheLookupFails(t *testing.T) {
	l := lookups()
	l.err = errors.New("database down")
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Host = "male-city.bool.test"
	rec := httptest.NewRecorder()
	module(l).ResolveTenant((&seen{}).handler()).ServeHTTP(rec, r)
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
	assert.NotContains(t, rec.Body.String(), "database down")
}

// request returns a request from user (none if "") in t (none if empty).
func request(user string, t tenant.Tenant) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := r.Context()
	if user != "" {
		ctx = auth.NewContext(ctx, auth.Caller{Token: auth.Token{Subject: "s"}, User: &identity.User{ID: user}})
	}
	if t.ID != "" {
		ctx = tenant.With(ctx, t)
	}
	return r.WithContext(ctx)
}

func TestRequireMember(t *testing.T) {
	for name, c := range map[string]struct {
		r    *http.Request
		want int
	}{
		"an active member":        {request("u-member", cityTenant), http.StatusNoContent},
		"a person who is not one": {request("u-other", cityTenant), http.StatusNotFound},
		"no tenant":               {request("u-member", tenant.Tenant{}), http.StatusNotFound},
		"no person":               {request("", cityTenant), http.StatusNotFound},
	} {
		t.Run(name, func(t *testing.T) {
			var s seen
			rec := httptest.NewRecorder()
			module(lookups()).RequireMember(s.handler()).ServeHTTP(rec, c.r)
			assert.Equal(t, c.want, rec.Code)
			if c.want == http.StatusNoContent {
				assert.Equal(t, tenant.Membership{ID: "m-1", IsOwner: true}, s.membership)
			} else {
				assert.False(t, s.called)
				assert.Equal(t, notFound, detail(t, rec), "the same answer as an unknown host")
			}
		})
	}
}

func TestRequireMemberWhenTheLookupFails(t *testing.T) {
	l := lookups()
	l.err = errors.New("database down")
	rec := httptest.NewRecorder()
	module(l).RequireMember((&seen{}).handler()).ServeHTTP(rec, request("u-member", cityTenant))
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
}

func TestRequireActiveTenant(t *testing.T) {
	for status, want := range map[string]string{
		"active":       "",
		"provisioning": TypeTenantProvisioning,
		"suspended":    TypeTenantSuspended,
		"archived":     TypeTenantArchived,
		"unheard-of":   "about:blank",
	} {
		t.Run(status, func(t *testing.T) {
			var s seen
			rec := httptest.NewRecorder()
			module(lookups()).RequireActiveTenant(s.handler()).ServeHTTP(rec,
				request("u-member", tenant.Tenant{ID: "t-city", Status: status}))
			if want == "" {
				assert.Equal(t, http.StatusNoContent, rec.Code)
				return
			}
			assert.Equal(t, http.StatusForbidden, rec.Code)
			assert.False(t, s.called)
			var body struct{ Type string }
			require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))
			assert.Equal(t, want, body.Type)
		})
	}

	rec := httptest.NewRecorder()
	module(lookups()).RequireActiveTenant((&seen{}).handler()).ServeHTTP(rec, request("u-member", tenant.Tenant{}))
	assert.Equal(t, http.StatusNotFound, rec.Code, "no tenant")
}

func detail(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct{ Detail string }
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&body))
	return body.Detail
}
