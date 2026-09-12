//go:build integration

package tenancy_test

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/db/sqlc"
	"github.com/boolmv/goerp/internal/tenancy"
)

// fakeKratosAdmin models just enough of Kratos's admin API for Provision: create identity, issue a
// recovery link, delete identity (the compensating action on a failed provision).
type fakeKratosAdmin struct {
	mu               sync.Mutex
	identities       map[string]bool
	failRecoveryLink bool
	deletedIDs       []string
}

func newFakeKratosAdmin() *fakeKratosAdmin {
	return &fakeKratosAdmin{identities: map[string]bool{}}
}

func (f *fakeKratosAdmin) server() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()

		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/admin/identities":
			id := randHex(t16)
			f.identities[id] = true
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]string{"id": id})
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, "/admin/identities/"):
			id := strings.TrimPrefix(r.URL.Path, "/admin/identities/")
			delete(f.identities, id)
			f.deletedIDs = append(f.deletedIDs, id)
			w.WriteHeader(http.StatusNoContent)
		case r.Method == http.MethodPost && r.URL.Path == "/admin/recovery/link":
			if f.failRecoveryLink {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]string{"recovery_link": "http://kratos.test/recover?code=abc"})
		default:
			http.NotFound(w, r)
		}
	}))
}

const t16 = 16

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	// format as a UUID-shaped hex string so auth.ParseUUID accepts it
	return uuidLike(b)
}

func uuidLike(b []byte) string {
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	const hex = "0123456789abcdef"
	buf := make([]byte, 36)
	pos := 0
	for i, byt := range b {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			buf[pos] = '-'
			pos++
		}
		buf[pos] = hex[byt>>4]
		buf[pos+1] = hex[byt&0x0f]
		pos += 2
	}
	return string(buf)
}

func TestProvision_Success(t *testing.T) {
	ctx := context.Background()
	fk := newFakeKratosAdmin()
	srv := fk.server()
	defer srv.Close()
	kratos := auth.NewKratos(srv.URL, srv.URL)

	actor := newTestUUID(t)
	if _, err := sqlc.New(env.AppPool).CreateUser(ctx, sqlc.CreateUserParams{ID: actor, Email: "operator-provisioning@example.test", Name: "Operator"}); err != nil {
		t.Fatalf("CreateUser(actor): %v", err)
	}

	result, err := tenancy.Provision(ctx, env.AppPool, kratos, tenancy.ProvisionParams{
		Slug: "test-provision-ok", Code: "TPOK", Name: "Test Provision OK",
		Country: "MV", OwnerEmail: "owner@test-provision-ok.test", OwnerName: "New Owner",
		ActorUserID: actor,
	})
	if err != nil {
		t.Fatalf("Provision: %v", err)
	}
	if result.Tenant.Slug != "test-provision-ok" {
		t.Fatalf("want slug test-provision-ok, got %q", result.Tenant.Slug)
	}
	if result.RecoveryLink == "" {
		t.Fatal("want a non-empty recovery link")
	}

	got, err := sqlc.New(env.AppPool).GetTenantBySlug(ctx, "test-provision-ok")
	if err != nil {
		t.Fatalf("GetTenantBySlug: %v", err)
	}
	if got.ID != result.Tenant.ID {
		t.Fatal("provisioned tenant not visible via a fresh query — commit did not happen?")
	}
	if _, err := sqlc.New(env.AppPool).GetOwnerTenantUser(ctx, got.ID); err != nil {
		t.Fatalf("GetOwnerTenantUser: want an owner membership, got %v", err)
	}

	entries := readAuditEntries(t, got.ID, got.ID, "create")
	if len(entries) != 1 {
		t.Fatalf("want 1 create audit entry, got %d", len(entries))
	}
	if entries[0].ActorUserID != actor {
		t.Fatalf("want actor %v recorded on the create entry, got %v", actor, entries[0].ActorUserID)
	}
}

func TestProvision_RecoveryLinkFailureRollsBackAndDeletesIdentity(t *testing.T) {
	ctx := context.Background()
	fk := newFakeKratosAdmin()
	fk.failRecoveryLink = true
	srv := fk.server()
	defer srv.Close()
	kratos := auth.NewKratos(srv.URL, srv.URL)

	_, err := tenancy.Provision(ctx, env.AppPool, kratos, tenancy.ProvisionParams{
		Slug: "test-provision-fail", Code: "TPFAIL", Name: "Test Provision Fail",
		Country: "MV", OwnerEmail: "owner@test-provision-fail.test", OwnerName: "New Owner",
	})
	if err == nil {
		t.Fatal("want an error when the recovery-link step fails")
	}

	if _, err := sqlc.New(env.AppPool).GetTenantBySlug(ctx, "test-provision-fail"); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("want no squatted slug after a failed provision, got tenant lookup error %v", err)
	}

	fk.mu.Lock()
	deleted := len(fk.deletedIDs) == 1
	fk.mu.Unlock()
	if !deleted {
		t.Fatal("want the orphaned Kratos identity to be deleted as compensation")
	}
}
