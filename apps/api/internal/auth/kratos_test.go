package auth_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/boolmv/goerp/internal/auth"
)

func TestWhoamiActive(t *testing.T) {
	var gotCookie string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sessions/whoami" {
			http.NotFound(w, r)
			return
		}
		gotCookie = r.Header.Get("Cookie")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":     "sess-1",
			"active": true,
			"identity": map[string]any{
				"id":     "018f7d3a-0000-7000-8000-000000000001",
				"traits": map[string]any{"email": "a@b.mv", "name": "Aisha"},
			},
		})
	}))
	defer srv.Close()

	s, err := auth.NewKratos(srv.URL, srv.URL).Whoami(context.Background(), "ory_kratos_session=abc")
	if err != nil {
		t.Fatalf("Whoami: %v", err)
	}
	if !s.Active {
		t.Fatal("want active session")
	}
	if s.Identity.Traits.Email != "a@b.mv" || s.Identity.Traits.Name != "Aisha" {
		t.Fatalf("traits: %+v", s.Identity.Traits)
	}
	if gotCookie != "ory_kratos_session=abc" {
		t.Fatalf("cookie not forwarded: %q", gotCookie)
	}
}

func TestWhoamiNoSession(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	_, err := auth.NewKratos(srv.URL, srv.URL).Whoami(context.Background(), "x")
	if !errors.Is(err, auth.ErrNoSession) {
		t.Fatalf("want ErrNoSession, got %v", err)
	}
}
