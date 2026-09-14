package auth_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/boolmv/erp/internal/auth"
)

// An unreachable or broken PDP must NOT look like a denial: callers answer 502 for the former and
// 403 for the latter, and telling an operator they lack a permission they hold is its own bug.
func TestAuthorize_UpstreamFailureIsNotForbidden(t *testing.T) {
	for _, tc := range []struct {
		name    string
		handler http.HandlerFunc
	}{
		{"non-200", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) }},
		{"undecodable body", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("not json")) }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(tc.handler)
			defer srv.Close()

			err := auth.NewCerbos(srv.URL).AllowSelfProfileRead(context.Background(), "uid-1")
			if err == nil {
				t.Fatal("want an error when the PDP cannot answer, got nil (request would be allowed)")
			}
			if errors.Is(err, auth.ErrForbidden) {
				t.Fatalf("an upstream failure must not be reported as a policy denial: %v", err)
			}
		})
	}
}

func TestAllowSelfProfileRead(t *testing.T) {
	for _, tc := range []struct {
		name    string
		effect  string
		wantErr error
	}{
		{"allow", "EFFECT_ALLOW", nil},
		{"deny", "EFFECT_DENY", auth.ErrForbidden},
		// An effect we don't recognise is a denial, not an accidental allow.
		{"unknown effect", "EFFECT_NO_MATCH", auth.ErrForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/check/resources" {
					http.NotFound(w, r)
					return
				}
				_ = json.NewEncoder(w).Encode(map[string]any{
					"results": []map[string]any{{"actions": map[string]string{"read": tc.effect}}},
				})
			}))
			defer srv.Close()

			err := auth.NewCerbos(srv.URL).AllowSelfProfileRead(context.Background(), "uid-1")
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("want %v, got %v", tc.wantErr, err)
			}
		})
	}
}
