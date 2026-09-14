//go:build integration

package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/httpapi"
	"github.com/boolmv/erp/internal/tenancy"
)

// fakeIdentityCounter is package-level so minted ids stay unique across every fake server in the
// package. Per-server counters each restarted at 1, so any two tests that provisioned a tenant
// minted the SAME identity id and collided on users_pkey — which the old blanket "slug/code may
// already be taken" response quietly disguised as an expected conflict.
var fakeIdentityCounter atomic.Uint64

// fakeKratosFor serves whoami for one fixed identity — parameterised (unlike me_integration_test.go's
// fakeKratos, which always answers as the one testUID) so each test can act as its own seeded
// operator. Also serves the admin identity/recovery-link endpoints tenancy.Provision calls when a
// test actually provisions a new tenant.
func fakeKratosFor(userID, email string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/sessions/whoami":
			if r.Header.Get("Cookie") == "" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":     "s",
				"active": true,
				"identity": map[string]any{
					"id":     userID,
					"traits": map[string]any{"email": email, "name": "Operator"},
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/admin/identities":
			id := fmt.Sprintf("%08d-0000-7000-8000-000000000000", fakeIdentityCounter.Add(1))
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]string{"id": id})
		case r.Method == http.MethodPost && r.URL.Path == "/admin/recovery/link":
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]string{"recovery_link": "http://kratos.test/recover?code=abc"})
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/admin/identities/"):
			w.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(w, r)
		}
	}))
}

func newAdminAPITestRouter(t *testing.T, kratosURL string) http.Handler {
	t.Helper()
	cerbosSrv := fakeAuthzCerbos()
	t.Cleanup(cerbosSrv.Close)
	deps := httpapi.PlatformDeps{
		Pool:   env.Pool,
		Kratos: auth.NewKratos(kratosURL, kratosURL),
		Cerbos: auth.NewCerbos(cerbosSrv.URL),
	}
	return httpapi.New(deps, tenancy.Register(deps))
}

func doAsOperator(t *testing.T, h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Cookie", "ory_kratos_session=abc")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestAdminTenants_ListAndGet(t *testing.T) {
	userID := setupOperatorFixture(t, "list-e2e", "")
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "list-e2e@example.test")
	defer kratos.Close()
	h := newAdminAPITestRouter(t, kratos.URL)

	rec := doAsOperator(t, h, http.MethodGet, "/v1/admin/tenants", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("list: want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var list []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(list) == 0 {
		t.Fatal("want at least one tenant in the list")
	}

	id, _ := list[0]["id"].(string)
	rec2 := doAsOperator(t, h, http.MethodGet, "/v1/admin/tenants/"+id, nil)
	if rec2.Code != http.StatusOK {
		t.Fatalf("get: want 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestAdminTenants_CreateProvisionsARealTenant(t *testing.T) {
	userID := setupOperatorFixture(t, "create-e2e", "platform:tenants:provision")
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "create-e2e@example.test")
	defer kratos.Close()
	h := newAdminAPITestRouter(t, kratos.URL)

	body := map[string]string{
		"slug": "e2e-created-co", "code": "E2ECO", "name": "E2E Created Co",
		"country": "MV", "party_type_code": "private-company", "institution_type_code": "business",
		"owner_email": "owner@e2e-created-co.test", "owner_name": "New Owner",
	}
	rec := doAsOperator(t, h, http.MethodPost, "/v1/admin/tenants", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Tenant       map[string]any `json:"tenant"`
		RecoveryLink string         `json:"recovery_link"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Tenant["slug"] != "e2e-created-co" {
		t.Fatalf("want slug e2e-created-co, got %v", resp.Tenant["slug"])
	}
	if resp.RecoveryLink == "" {
		t.Fatal("want a non-empty recovery link")
	}
}

// Validation failures answer 422 with a field -> messages map, reporting every problem at once.
func TestAdminTenants_CreateInvalidReturns422WithFieldErrors(t *testing.T) {
	userID := setupOperatorFixture(t, "create-invalid", "platform:tenants:provision")
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "create-invalid@example.test")
	defer kratos.Close()
	h := newAdminAPITestRouter(t, kratos.URL)

	rec := doAsOperator(t, h, http.MethodPost, "/v1/admin/tenants", map[string]string{
		"slug": "admin", "code": "", "name": "Reserved Slug Co", "country": "MV",
		"party_type_code": "private-company", "institution_type_code": "business",
		"owner_email": "not-an-email", "owner_name": "Owner",
	})
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("want 422, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Error     string              `json:"error"`
		RequestID string              `json:"request_id"`
		Errors    map[string][]string `json:"errors"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Error != "validation failed" || resp.RequestID == "" {
		t.Fatalf("want the standard error envelope, got %+v", resp)
	}
	// Reserved slug, missing code and malformed email all reported together.
	for _, field := range []string{"slug", "code", "owner_email"} {
		if len(resp.Errors[field]) == 0 {
			t.Errorf("want %q reported, got %v", field, resp.Errors)
		}
	}
}

// A duplicate is the caller's to fix and we can name the colliding field — unlike a Kratos or DB
// failure, which must not be reported as "already taken".
func TestAdminTenants_CreateDuplicateSlugIsAFieldError(t *testing.T) {
	userID := setupOperatorFixture(t, "create-dup", "platform:tenants:provision")
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "create-dup@example.test")
	defer kratos.Close()
	h := newAdminAPITestRouter(t, kratos.URL)

	body := map[string]string{
		"slug": "e2e-dup-co", "code": "E2EDUP", "name": "E2E Dup Co",
		"country": "MV", "party_type_code": "private-company", "institution_type_code": "business",
		"owner_email": "owner@e2e-dup-co.test", "owner_name": "Owner",
	}
	if rec := doAsOperator(t, h, http.MethodPost, "/v1/admin/tenants", body); rec.Code != http.StatusCreated {
		t.Fatalf("seed create: want 201, got %d: %s", rec.Code, rec.Body.String())
	}

	body["code"] = "E2EDUP2" // same slug, different code: the slug is what must collide
	body["owner_email"] = "owner2@e2e-dup-co.test"
	rec := doAsOperator(t, h, http.MethodPost, "/v1/admin/tenants", body)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("want 422 for a duplicate slug, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Errors map[string][]string `json:"errors"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Errors["slug"]) == 0 {
		t.Fatalf("want the duplicate attributed to slug, got %v", resp.Errors)
	}
}

func TestAdminTenants_CreateDeniedWithoutProvisionCapability(t *testing.T) {
	userID := setupOperatorFixture(t, "create-denied-e2e", "platform:tenants:suspend") // wrong capability
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "create-denied-e2e@example.test")
	defer kratos.Close()
	h := newAdminAPITestRouter(t, kratos.URL)

	body := map[string]string{
		"slug": "should-not-exist", "code": "SNE", "name": "Should Not Exist",
		"country": "MV", "party_type_code": "private-company", "institution_type_code": "business",
		"owner_email": "owner@should-not-exist.test", "owner_name": "Nobody",
	}
	rec := doAsOperator(t, h, http.MethodPost, "/v1/admin/tenants", body)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("want 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAdminTenants_SuspendReactivateArchive(t *testing.T) {
	userID := setupOperatorFixture(t, "lifecycle-e2e", "platform:tenants:suspend")
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "lifecycle-e2e@example.test")
	defer kratos.Close()
	h := newAdminAPITestRouter(t, kratos.URL)

	// Create the target tenant directly (not through the API — that's covered by the create test).
	target := createLifecycleTargetTenant(t, "e2e-lifecycle-target")

	rec := doAsOperator(t, h, http.MethodPost, fmt.Sprintf("/v1/admin/tenants/%s/suspend", target), nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("suspend: want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertTenantStatus(t, rec, "suspended")

	rec = doAsOperator(t, h, http.MethodPost, fmt.Sprintf("/v1/admin/tenants/%s/reactivate", target), nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("reactivate: want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertTenantStatus(t, rec, "active")

	rec = doAsOperator(t, h, http.MethodPost, fmt.Sprintf("/v1/admin/tenants/%s/archive", target), nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("archive: want 200, got %d: %s", rec.Code, rec.Body.String())
	}
	assertTenantStatus(t, rec, "archived")
}

// A transition the tenant's current status forbids is a client error (409), and an unknown tenant is
// a 404 — neither is an "internal" 500. Archived ends the lifecycle (FR-TEN-03), so nothing reopens it.
func TestAdminTenants_IllegalTransitionsAndUnknownTenant(t *testing.T) {
	userID := setupOperatorFixture(t, "lifecycle-illegal", "platform:tenants:suspend")
	kratos := fakeKratosFor(uuidToStringAdmin(userID), "lifecycle-illegal@example.test")
	defer kratos.Close()
	h := newAdminAPITestRouter(t, kratos.URL)

	target := createLifecycleTargetTenant(t, "e2e-illegal-target")

	// Reactivating a tenant that is active (not suspended) is not a legal transition.
	rec := doAsOperator(t, h, http.MethodPost, fmt.Sprintf("/v1/admin/tenants/%s/reactivate", target), nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("reactivate an active tenant: want 409, got %d: %s", rec.Code, rec.Body.String())
	}

	if rec := doAsOperator(t, h, http.MethodPost, fmt.Sprintf("/v1/admin/tenants/%s/archive", target), nil); rec.Code != http.StatusOK {
		t.Fatalf("archive: want 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Archived is terminal: it can be neither resurrected nor re-archived.
	for _, action := range []string{"reactivate", "suspend", "archive"} {
		rec := doAsOperator(t, h, http.MethodPost, fmt.Sprintf("/v1/admin/tenants/%s/%s", target, action), nil)
		if rec.Code != http.StatusConflict {
			t.Fatalf("%s an archived tenant: want 409, got %d: %s", action, rec.Code, rec.Body.String())
		}
	}

	// A well-formed id that matches no tenant is a 404, not a 500.
	rec = doAsOperator(t, h, http.MethodPost, "/v1/admin/tenants/018f7d3a-0000-7000-8000-0000000000aa/suspend", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("suspend an unknown tenant: want 404, got %d: %s", rec.Code, rec.Body.String())
	}
}

func assertTenantStatus(t *testing.T, rec *httptest.ResponseRecorder, want string) {
	t.Helper()
	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["status"] != want {
		t.Fatalf("want status %q, got %v", want, resp["status"])
	}
}

func createLifecycleTargetTenant(t *testing.T, slug string) string {
	t.Helper()
	ctx := context.Background()
	q := sqlc.New(env.Pool)
	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	tenant, err := q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug: slug, Code: fmt.Sprintf("LCT%d", treeKey), Name: "Lifecycle Target",
		TreeKey: treeKey, Column7: fmt.Sprintf("%d", treeKey), Country: "MV", Status: "active",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	return uuidToStringAdmin(tenant.ID)
}
