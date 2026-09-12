//go:build integration

package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Bool-Maldives/erp/internal/auth"
	"github.com/Bool-Maldives/erp/internal/db/sqlc"
	"github.com/Bool-Maldives/erp/internal/dbtest"
	"github.com/Bool-Maldives/erp/internal/httpapi"
)

var env *dbtest.Env

func TestMain(m *testing.M) {
	ctx := context.Background()
	e, err := dbtest.Start(ctx)
	if err != nil {
		fmt.Fprintln(os.Stderr, "dbtest start:", err)
		os.Exit(1)
	}
	env = e
	code := m.Run()
	env.Close(ctx)
	os.Exit(code)
}

const testUID = "018f7d3a-0000-7000-8000-000000000001"

// fakeKratos serves whoami (active session for the fixed identity) + a health endpoint.
func fakeKratos(active bool) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/sessions/whoami":
			if r.Header.Get("Cookie") == "" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":     "s",
				"active": active,
				"identity": map[string]any{
					"id":     testUID,
					"traits": map[string]any{"email": "owner@malecouncil.mv", "name": "Owner"},
				},
			})
		case "/health/ready":
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		default:
			http.NotFound(w, r)
		}
	}))
}

func fakeCerbos(allow bool) *httptest.Server {
	eff := "EFFECT_DENY"
	if allow {
		eff = "EFFECT_ALLOW"
	}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/check/resources" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]any{{"actions": map[string]string{"read": eff}}},
		})
	}))
}

// TestMeEndToEnd exercises the full backbone: whoami → JIT-upsert → Cerbos allow → DB read.
func TestMeEndToEnd(t *testing.T) {
	k := fakeKratos(true)
	defer k.Close()
	c := fakeCerbos(true)
	defer c.Close()
	cerbos := auth.NewCerbos(c.URL)

	h := httpapi.New(httpapi.PlatformDeps{
		Pool:   env.Pool,
		Kratos: auth.NewKratos(k.URL, k.URL),
		Cerbos: cerbos,
	}, auth.Register(env.Pool, cerbos))
	srv := httptest.NewServer(h)
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/v1/me", nil)
	req.Header.Set("Cookie", "ory_kratos_session=abc")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status: want 200, got %d", resp.StatusCode)
	}
	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["id"] != testUID || body["email"] != "owner@malecouncil.mv" {
		t.Fatalf("body: %+v", body)
	}

	// JIT-upsert persisted the user mirror.
	id, _ := auth.ParseUUID(testUID)
	u, err := sqlc.New(env.Pool).GetUserByID(context.Background(), id)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if u.Email != "owner@malecouncil.mv" || !u.LastLoginAt.Valid {
		t.Fatalf("upserted user: %+v", u)
	}
}

func TestMeUnauthenticated(t *testing.T) {
	k := fakeKratos(true)
	defer k.Close()
	c := fakeCerbos(true)
	defer c.Close()
	cerbos := auth.NewCerbos(c.URL)

	h := httpapi.New(httpapi.PlatformDeps{
		Pool:   env.Pool,
		Kratos: auth.NewKratos(k.URL, k.URL),
		Cerbos: cerbos,
	}, auth.Register(env.Pool, cerbos))
	srv := httptest.NewServer(h)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/v1/me") // no cookie
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status: want 401, got %d", resp.StatusCode)
	}
}
