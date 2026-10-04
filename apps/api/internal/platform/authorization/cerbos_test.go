package authorization

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/cerbos/cerbos-sdk-go/cerbos"
	effectv1 "github.com/cerbos/cerbos/api/genpb/cerbos/effect/v1"
	enginev1 "github.com/cerbos/cerbos/api/genpb/cerbos/engine/v1"
	responsev1 "github.com/cerbos/cerbos/api/genpb/cerbos/response/v1"
	schemav1 "github.com/cerbos/cerbos/api/genpb/cerbos/schema/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/requestid"
)

// fakeClient answers like Cerbos with prepared responses and remembers what it
// was asked.
type fakeClient struct {
	check      *responsev1.CheckResourcesResponse
	plan       *responsev1.PlanResourcesResponse
	err        error
	principal  *cerbos.Principal
	resource   string
	hadTimeout bool
}

func (f *fakeClient) CheckResources(ctx context.Context, p *cerbos.Principal, b *cerbos.ResourceBatch) (*cerbos.CheckResourcesResponse, error) {
	f.principal = p
	_, f.hadTimeout = ctx.Deadline()
	if len(b.Batch) > 0 {
		f.resource = b.Batch[0].GetResource().GetKind() + "/" + b.Batch[0].GetResource().GetId()
	}
	if f.err != nil {
		return nil, f.err
	}
	return &cerbos.CheckResourcesResponse{CheckResourcesResponse: f.check}, nil
}

func (f *fakeClient) PlanResources(ctx context.Context, p *cerbos.Principal, _ *cerbos.Resource, _ ...string) (*cerbos.PlanResourcesResponse, error) {
	f.principal = p
	_, f.hadTimeout = ctx.Deadline()
	if f.err != nil {
		return nil, f.err
	}
	return &cerbos.PlanResourcesResponse{PlanResourcesResponse: f.plan}, nil
}

func person(context.Context) (Principal, error) {
	return Principal{ID: "user-1", Roles: []string{"user"}, Attributes: map[string]any{"tenant_id": "t-1"}}, nil
}

func result(kind, id string, effects map[string]effectv1.Effect, errs ...*schemav1.ValidationError) *responsev1.CheckResourcesResponse {
	return &responsev1.CheckResourcesResponse{Results: []*responsev1.CheckResourcesResponse_ResultEntry{{
		Resource:         &responsev1.CheckResourcesResponse_ResultEntry_Resource{Kind: kind, Id: id},
		Actions:          effects,
		ValidationErrors: errs,
	}}}
}

var user1 = Resource{Kind: "identity:user", ID: "user-1"}

func TestCheckAllowsOnlyAnExplicitAllow(t *testing.T) {
	allow := &fakeClient{check: result("identity:user", "user-1", map[string]effectv1.Effect{"view": effectv1.Effect_EFFECT_ALLOW})}
	require.NoError(t, NewCerbos(allow, person, time.Second).Check(context.Background(), "view", user1))
	assert.True(t, allow.hadTimeout, "every call has a deadline")

	deny := &fakeClient{check: result("identity:user", "user-1", map[string]effectv1.Effect{"view": effectv1.Effect_EFFECT_DENY})}
	assert.ErrorIs(t, NewCerbos(deny, person, time.Second).Check(context.Background(), "view", user1), ErrDenied)

	missing := &fakeClient{check: result("identity:user", "user-1", map[string]effectv1.Effect{"edit": effectv1.Effect_EFFECT_ALLOW})}
	assert.ErrorIs(t, NewCerbos(missing, person, time.Second).Check(context.Background(), "view", user1), ErrDenied,
		"an action missing from the answer is denied")
}

func TestCheckMatchesTheResultsKindAsWellAsItsID(t *testing.T) {
	otherKind := &fakeClient{check: result("identity:client", "user-1", map[string]effectv1.Effect{"view": effectv1.Effect_EFFECT_ALLOW})}
	assert.Error(t, NewCerbos(otherKind, person, time.Second).Check(context.Background(), "view", user1))
}

func TestCheckReportsAnInvalidRequestAsABug(t *testing.T) {
	invalid := &fakeClient{check: result("identity:user", "user-1", map[string]effectv1.Effect{"view": effectv1.Effect_EFFECT_DENY},
		&schemav1.ValidationError{Path: "/tenant_id", Message: "missing properties: 'tenant_id'", Source: schemav1.ValidationError_SOURCE_PRINCIPAL})}
	err := NewCerbos(invalid, person, time.Second).Check(context.Background(), "view", user1)
	require.ErrorIs(t, err, ErrInvalid)
	assert.Contains(t, err.Error(), "missing properties: 'tenant_id'")
}

func TestCheckIsUnavailableWhenCerbosIs(t *testing.T) {
	down := &fakeClient{err: errors.New("connection refused")}
	assert.ErrorIs(t, NewCerbos(down, person, time.Second).Check(context.Background(), "view", user1), ErrUnavailable)
}

func TestCheckDeniesWithoutACaller(t *testing.T) {
	client := &fakeClient{}
	nobody := func(context.Context) (Principal, error) { return Principal{}, errors.New("no caller") }
	assert.ErrorIs(t, NewCerbos(client, nobody, time.Second).Check(context.Background(), "view", user1), ErrDenied)
	empty := func(context.Context) (Principal, error) { return Principal{ID: "x"}, nil }
	assert.ErrorIs(t, NewCerbos(client, empty, time.Second).Check(context.Background(), "view", user1), ErrDenied, "no roles")
	assert.Nil(t, client.principal, "Cerbos is never asked")
}

func TestCheckSendsThePrincipalWithTheDecisionsFacts(t *testing.T) {
	client := &fakeClient{check: result("hrms:employee", newRecordID, map[string]effectv1.Effect{"create": effectv1.Effect_EFFECT_ALLOW})}
	err := NewCerbos(client, person, time.Second).Check(context.Background(), "create",
		Resource{Kind: "hrms:employee", Attributes: map[string]any{"tenant_id": "t-1"}},
		Facts(map[string]any{"employee_id": "e-9"}))
	require.NoError(t, err)
	assert.Equal(t, "hrms:employee/new", client.resource, "a record being created gets the placeholder ID")
	assert.Equal(t, "user-1", client.principal.Obj.GetId())
	assert.Equal(t, []string{"user"}, client.principal.Obj.GetRoles())
	attrs := client.principal.Obj.GetAttr()
	assert.Equal(t, "t-1", attrs["tenant_id"].GetStringValue())
	assert.Equal(t, "e-9", attrs["employee_id"].GetStringValue())
}

func plan(kind enginev1.PlanResourcesFilter_Kind, errs ...*schemav1.ValidationError) *responsev1.PlanResourcesResponse {
	return &responsev1.PlanResourcesResponse{Filter: &enginev1.PlanResourcesFilter{Kind: kind}, ValidationErrors: errs}
}

func TestCanAllowsWhenSomeRecordMayBe(t *testing.T) {
	for kind, want := range map[enginev1.PlanResourcesFilter_Kind]error{
		enginev1.PlanResourcesFilter_KIND_ALWAYS_ALLOWED: nil,
		enginev1.PlanResourcesFilter_KIND_CONDITIONAL:    nil,
		enginev1.PlanResourcesFilter_KIND_ALWAYS_DENIED:  ErrDenied,
	} {
		client := &fakeClient{plan: plan(kind)}
		err := NewCerbos(client, person, time.Second).Can(context.Background(), "approve", "hrms:leave_request")
		if want == nil {
			assert.NoError(t, err, kind.String())
		} else {
			assert.ErrorIs(t, err, want, kind.String())
		}
	}
	noFilter := &fakeClient{plan: &responsev1.PlanResourcesResponse{}}
	assert.ErrorIs(t, NewCerbos(noFilter, person, time.Second).Can(context.Background(), "approve", "x"), ErrDenied)
}

func TestCanReportsInvalidAndUnavailable(t *testing.T) {
	invalid := &fakeClient{plan: plan(enginev1.PlanResourcesFilter_KIND_ALWAYS_DENIED,
		&schemav1.ValidationError{Message: "missing properties: 'tenant_id'"})}
	assert.ErrorIs(t, NewCerbos(invalid, person, time.Second).Can(context.Background(), "approve", "x"), ErrInvalid)
	down := &fakeClient{err: errors.New("deadline exceeded")}
	assert.ErrorIs(t, NewCerbos(down, person, time.Second).Can(context.Background(), "approve", "x"), ErrUnavailable)
	nobody := func(context.Context) (Principal, error) { return Principal{}, errors.New("no caller") }
	assert.ErrorIs(t, NewCerbos(down, nobody, time.Second).Can(context.Background(), "approve", "x"), ErrDenied)
}

func TestDialNeedsNoRunningCerbos(t *testing.T) {
	c, err := Dial(Settings{Addr: "127.0.0.1:1", Timeout: time.Second})
	require.NoError(t, err, "connects lazily")
	require.NoError(t, c.Close())
	_, err = Dial(Settings{Addr: "127.0.0.1:1", Timeout: time.Second, TLSCAFile: "/nonexistent/ca.pem"})
	assert.Error(t, err, "an unreadable CA certificate stops startup")
}

func TestRequestIDFollowsTheRequest(t *testing.T) {
	var seen string
	h := requestid.Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		seen = requestID(r.Context())
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, rec.Header().Get(requestid.Header), seen, "Cerbos's decision log carries our request ID")
	assert.NotEmpty(t, requestID(context.Background()), "a CLI command or job still gets one")
}
