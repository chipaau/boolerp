//go:build feature

package reference_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/reference"
)

// Endpoint tests (C156) for the reference lists through the real router and
// PostgreSQL, one file per resource; this one holds the shared world and the checks
// common to every list. The Authenticated chain is the edition's; here it is the
// record-or-deny backstop (C155) alone, since the routes need no caller of their own,
// and Cerbos is an Authorizer stating allow or deny. Test rows use ISO's user-assigned
// codes (XA…), which no real country has, and the seeded rows are filtered out.

// stated is authorization faked: it notes every decision asked and answers allow.
type stated struct {
	allow bool
	cans  []string
}

func (s *stated) Check(ctx context.Context, _ string, _ authorization.Resource, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	return s.answer()
}

func (s *stated) Can(ctx context.Context, action, kind string, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	s.cans = append(s.cans, action+" "+kind)
	return s.answer()
}

func (s *stated) answer() error {
	if !s.allow {
		return authorization.ErrDenied
	}
	return nil
}

// referenceWorld holds test countries, legal forms, sectors, and institution types,
// some retired, created as the tables' owner in a rolled-back transaction.
func referenceWorld(t *testing.T) pgx.Tx {
	t.Helper()
	tx := testdb.OwnerTx(t)
	for _, sql := range []string{
		`INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES
			('XA', 'XAA', 'Xanadu Testland', '+991'), ('XB', 'XBB', 'Xavier Testland', '+992')`,
		`INSERT INTO countries (code, alpha3, name, phone_prefix, active_from, active_to)
			VALUES ('XR', 'XRR', 'Xeno Retired', '+993', now() - interval '2 days', now() - interval '1 day')`,
		`INSERT INTO countries (code, alpha3, name, phone_prefix, active_to)
			VALUES ('XL', 'XLL', 'Xylo Retiring', '+994', now() + interval '1 day')`,
		`INSERT INTO legal_forms (country, code, name, category, identity_document) VALUES
			('XA', 'x_company', 'Test Company', 'private', 'Test registration'),
			('XA', 'x_ministry', 'Test Ministry', 'government', NULL),
			('XB', 'x_company', 'Elsewhere Company', 'private', NULL)`,
		`INSERT INTO legal_forms (country, code, name, category, active_from, active_to)
			VALUES ('XA', 'x_gone', 'Test Gone', 'private', now() - interval '2 days', now() - interval '1 day')`,
		`INSERT INTO sectors (code, name) VALUES ('x_alpha', 'X Alpha sector'), ('x_beta', 'X Beta sector')`,
		`INSERT INTO sectors (code, name, active_from, active_to)
			VALUES ('x_gone', 'X Gone sector', now() - interval '2 days', now() - interval '1 day')`,
		`INSERT INTO institution_types (code, sector, name) VALUES
			('x_school', 'x_beta', 'X School'), ('x_clinic', 'x_alpha', 'X Clinic'),
			('x_bank', 'x_alpha', 'X Bank'), ('x_orphan', 'x_gone', 'X Orphan')`,
		`INSERT INTO institution_types (code, sector, name, active_from, active_to)
			VALUES ('x_old', 'x_alpha', 'X Old', now() - interval '2 days', now() - interval '1 day')`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err)
	}
	return tx
}

// referenceRouter mounts the module under /api/v1 as the edition does, over tx.
func referenceRouter(tx pgx.Tx, authz authorization.Authorizer) http.Handler {
	logger := slog.New(slog.DiscardHandler)
	s := platform.Services{Authz: authz, Logger: logger, Authenticated: chi.Chain(authorization.Enforce(logger))}
	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) { r.Group(reference.New(tx, logger).Routes(s)) })
	return r
}

func get[T any](t *testing.T, h http.Handler, path string) (*httptest.ResponseRecorder, httpinput.Page[T]) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	var p httpinput.Page[T]
	if rec.Code == http.StatusOK {
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &p))
	}
	return rec, p
}

func TestFeatureTheReferenceListsRefuse(t *testing.T) {
	tx := referenceWorld(t)
	h := referenceRouter(tx, &stated{allow: false})
	for _, path := range []string{"/api/v1/countries", "/api/v1/legal-forms?country=XA", "/api/v1/institution-types"} {
		rec, _ := get[country](t, h, path)
		assert.Equal(t, http.StatusForbidden, rec.Code, "Cerbos denies %s", path)
	}

	rec, _ := get[country](t, referenceRouter(tx, &stated{allow: true}), "/api/v1/countries?sort=alpha3")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, "an unknown sort")
	rec, _ = get[country](t, referenceRouter(tx, &stated{allow: true}), "/api/v1/institution-types?sort=sectorCode")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, "an unknown sort")
}

func TestFeatureAFailedReadIsUnavailable(t *testing.T) {
	tx := referenceWorld(t)
	h := referenceRouter(tx, &stated{allow: true})
	_, err := tx.Exec(t.Context(), `SELECT 1/0`) // the transaction is now aborted
	require.Error(t, err)
	for _, path := range []string{"/api/v1/countries", "/api/v1/legal-forms?country=XA", "/api/v1/institution-types"} {
		rec, _ := get[country](t, h, path)
		assert.Equal(t, http.StatusServiceUnavailable, rec.Code, path)
	}
}
