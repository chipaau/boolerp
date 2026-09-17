package httpapi_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/boolmv/erp/internal/httpapi"
)

func TestRequireSameOrigin(t *testing.T) {
	for _, tc := range []struct {
		name       string
		method     string
		host       string
		origin     string
		wantPassed bool
	}{
		// The SPA's own calls: same host, so indistinguishable from any legitimate use.
		{"same-origin write", http.MethodPost, "malecouncil.bool.test", "http://malecouncil.bool.test", true},
		{"same-origin write over https", http.MethodPost, "malecouncil.bool.test", "https://malecouncil.bool.test", true},

		// The case SameSite=Lax cannot see: a sibling subdomain is "same site" to the browser, so the
		// cookie rides along. This is an operator's session being used from a tenant's page.
		{"sibling subdomain write", http.MethodPost, "admin.bool.test", "http://malecouncil.bool.test", false},
		{"foreign origin write", http.MethodPost, "admin.bool.test", "https://evil.example", false},
		{"malformed origin", http.MethodPost, "admin.bool.test", "://not-a-url", false},

		// Non-browser clients send no Origin at all; refusing them would break server-to-server calls
		// and the e2e harness without stopping any browser attack.
		{"no origin header", http.MethodPost, "admin.bool.test", "", true},

		// Reads are contained by the absence of CORS headers: the calling page cannot read the reply.
		{"cross-origin read", http.MethodGet, "admin.bool.test", "https://evil.example", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			passed := false
			h := httpapi.RequireSameOrigin(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				passed = true
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(tc.method, "http://"+tc.host+"/v1/tenants", nil)
			req.Host = tc.host
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if passed != tc.wantPassed {
				t.Fatalf("reached handler = %v, want %v (status %d: %s)",
					passed, tc.wantPassed, rec.Code, rec.Body.String())
			}
			if !tc.wantPassed && rec.Code != http.StatusForbidden {
				t.Fatalf("want 403, got %d", rec.Code)
			}
		})
	}
}
