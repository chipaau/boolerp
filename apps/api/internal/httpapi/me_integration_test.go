//go:build integration

package httpapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/dbtest"
	"github.com/boolmv/erp/internal/httpapi"
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

// TestMeEndToEnd exercises the full backbone: whoami → mirror refresh → Cerbos allow → DB read.
func TestMeEndToEnd(t *testing.T) {
	k := fakeKratos(true)
	defer k.Close()
	c := fakeCerbos(true)
	defer c.Close()
	cerbos := auth.NewCerbos(c.URL)

	// The user must already exist — sign-in refreshes the mirror, it never creates it. Seed with a
	// stale name so the refresh from the Kratos traits is observable.
	id, _ := auth.ParseUUID(testUID)
	if _, err := sqlc.New(env.Pool).CreateUser(context.Background(), sqlc.CreateUserParams{
		ID: id, Email: "owner@malecouncil.mv", Name: "Stale Name",
	}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

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

	// Sign-in refreshed the mirror from the Kratos traits and stamped the login.
	u, err := sqlc.New(env.Pool).GetUserByID(context.Background(), id)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if u.Email != "owner@malecouncil.mv" || u.Name != "Owner" || !u.LastLoginAt.Valid {
		t.Fatalf("synced user: %+v", u)
	}
}

// A valid Kratos session for an identity nobody provisioned must be refused, and must not bring a
// user into existence — there is no self-registration, whatever method Kratos authenticated them by.
func TestMeUnprovisionedIdentityIsRefused(t *testing.T) {
	const unknownUID = "018f7d3a-0000-7000-8000-0000000000ff"
	k := fakeKratosFor(unknownUID, "stranger@gmail.com")
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
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status: want 403, got %d", resp.StatusCode)
	}

	id, _ := auth.ParseUUID(unknownUID)
	if _, err := sqlc.New(env.Pool).GetUserByID(context.Background(), id); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("a refused sign-in created a user row: err=%v", err)
	}
}

// A disabled account is refused by our own check, not merely by Kratos session revocation having
// worked — a still-live session must not get through.
func TestMeDisabledUserIsRefused(t *testing.T) {
	const disabledUID = "018f7d3a-0000-7000-8000-0000000000fe"
	id, _ := auth.ParseUUID(disabledUID)
	ctx := context.Background()
	if _, err := sqlc.New(env.Pool).CreateUser(ctx, sqlc.CreateUserParams{
		ID: id, Email: "disabled@malecouncil.mv", Name: "Disabled",
	}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	if _, err := env.Pool.Exec(ctx, "UPDATE users SET status = 'disabled' WHERE id = $1", id); err != nil {
		t.Fatalf("disable user: %v", err)
	}

	k := fakeKratosFor(disabledUID, "disabled@malecouncil.mv")
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
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status: want 403, got %d", resp.StatusCode)
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

// Admission is a read. It used to be an UPDATE, so every authenticated request took a row lock,
// left a dead tuple behind and made the API unable to serve reads from a replica. The write now
// happens only when the Kratos traits have drifted or the login stamp has gone stale — so a burst of
// requests from one signed-in user must leave the row untouched after the first.
func TestMeRepeatedRequestsDoNotRewriteTheUserRow(t *testing.T) {
	// Its own identity: tests in this package share one committed database, so reusing testUID would
	// collide with TestMeEndToEnd's user.
	const uid = "018f7d3a-0000-7000-8000-0000000000fd"
	const email = "repeat@malecouncil.mv"
	k := fakeKratosFor(uid, email)
	defer k.Close()
	c := fakeCerbos(true)
	defer c.Close()
	cerbos := auth.NewCerbos(c.URL)

	id, _ := auth.ParseUUID(uid)
	ctx := context.Background()
	if _, err := sqlc.New(env.Pool).CreateUser(ctx, sqlc.CreateUserParams{
		ID: id, Email: email, Name: "Operator",
	}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	h := httpapi.New(httpapi.PlatformDeps{
		Pool: env.Pool, Kratos: auth.NewKratos(k.URL, k.URL), Cerbos: cerbos,
	}, auth.Register(env.Pool, cerbos))
	srv := httptest.NewServer(h)
	defer srv.Close()

	call := func() {
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
	}

	// First call stamps the login (the row has never been used).
	call()
	q := sqlc.New(env.Pool)
	first, err := q.GetUserByID(ctx, id)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if !first.LastLoginAt.Valid {
		t.Fatal("want the first request to stamp last_login_at")
	}

	// Subsequent calls have nothing to write: same traits, stamp still fresh.
	for i := 0; i < 3; i++ {
		call()
	}
	after, err := q.GetUserByID(ctx, id)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if !after.UpdatedAt.Time.Equal(first.UpdatedAt.Time) {
		t.Fatalf("the user row was rewritten by a request with nothing to change (updated_at %v -> %v)",
			first.UpdatedAt.Time, after.UpdatedAt.Time)
	}
	if !after.LastLoginAt.Time.Equal(first.LastLoginAt.Time) {
		t.Fatalf("last_login_at was rewritten within the stamp interval (%v -> %v)",
			first.LastLoginAt.Time, after.LastLoginAt.Time)
	}

	// But a stale stamp must still be refreshed — the column has to stay meaningful.
	if _, err := env.Pool.Exec(ctx,
		`UPDATE users SET last_login_at = now() - interval '1 hour' WHERE id = $1`, id); err != nil {
		t.Fatalf("age the stamp: %v", err)
	}
	call()
	refreshed, err := q.GetUserByID(ctx, id)
	if err != nil {
		t.Fatalf("GetUserByID: %v", err)
	}
	if !refreshed.LastLoginAt.Time.After(first.LastLoginAt.Time.Add(-time.Hour)) ||
		refreshed.LastLoginAt.Time.Before(first.LastLoginAt.Time) {
		t.Fatalf("want a stale stamp refreshed, got %v", refreshed.LastLoginAt.Time)
	}
}
