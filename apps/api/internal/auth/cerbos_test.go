package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/boolmv/erp/internal/auth"
)

func TestAllowSelfProfileRead(t *testing.T) {
	for _, tc := range []struct {
		name   string
		effect string
		want   bool
	}{
		{"allow", "EFFECT_ALLOW", true},
		{"deny", "EFFECT_DENY", false},
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

			got, err := auth.NewCerbos(srv.URL).AllowSelfProfileRead(context.Background(), "uid-1")
			if err != nil {
				t.Fatalf("check: %v", err)
			}
			if got != tc.want {
				t.Fatalf("want %v, got %v", tc.want, got)
			}
		})
	}
}
