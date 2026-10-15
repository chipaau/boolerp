//go:build feature

package reference_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/reference"
)

// Endpoint tests (C156) for the reference lists through the real router and
// PostgreSQL. The Authenticated chain is the edition's; here it is the record-or-deny backstop
// (C155) alone, since the routes need no caller of their own, and
// Cerbos is an Authorizer stating allow or deny. Test rows use ISO's user-assigned
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

type page[T any] struct {
	Items                 []T
	Page, PageSize, Total int
}

func get[T any](t *testing.T, h http.Handler, path string) (*httptest.ResponseRecorder, page[T]) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	var p page[T]
	if rec.Code == http.StatusOK {
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &p))
	}
	return rec, p
}

type country struct{ Code, Alpha3, Name, PhonePrefix string }

func TestFeatureTheCountryListShowsCurrentCountries(t *testing.T) {
	authz := &stated{allow: true}
	h := referenceRouter(referenceWorld(t), authz)

	rec, p := get[country](t, h, "/api/v1/countries?q=testland")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:country"}, authz.cans, "Cerbos decides the list")
	assert.Equal(t, []country{
		{"XA", "XAA", "Xanadu Testland", "+991"}, {"XB", "XBB", "Xavier Testland", "+992"},
	}, p.Items, "by name")
	assert.Equal(t, 300, p.PageSize, "every country in one page")
	assert.Equal(t, 2, p.Total)

	_, p = get[country](t, h, "/api/v1/countries?q=x&sort=-code&pageSize=300")
	codes := []string{}
	for _, c := range p.Items {
		if strings.HasPrefix(c.Name, "X") && len(c.Code) == 2 && c.Code[0] == 'X' {
			codes = append(codes, c.Code)
		}
	}
	assert.Equal(t, []string{"XL", "XB", "XA"}, codes, "retiring later is still current; retired is not")

	rec, _ = get[country](t, h, "/api/v1/countries?pageSize=301")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
}

type legalForm struct {
	ID, Code, Name, Category string
	IdentityDocument         *string
}

func TestFeatureTheLegalFormListShowsACountrysCurrentForms(t *testing.T) {
	authz := &stated{allow: true}
	h := referenceRouter(referenceWorld(t), authz)

	rec, p := get[legalForm](t, h, "/api/v1/legal-forms?country=XA")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:legal_form"}, authz.cans)
	require.Len(t, p.Items, 2, "XB's form and the retired one are left out")
	company, ministry := p.Items[0], p.Items[1]
	assert.Equal(t, "x_company", company.Code, "by name")
	assert.Equal(t, "Test Company", company.Name)
	assert.Equal(t, "private", company.Category)
	require.NotNil(t, company.IdentityDocument)
	assert.Equal(t, "Test registration", *company.IdentityDocument)
	assert.NotEmpty(t, company.ID)
	assert.Equal(t, "x_ministry", ministry.Code)
	assert.Nil(t, ministry.IdentityDocument, "a form naming no document")
	assert.Equal(t, 2, p.Total)

	_, p = get[legalForm](t, h, "/api/v1/legal-forms?country=XA&page=9")
	assert.Empty(t, p.Items, "past the last page")
	assert.Equal(t, 2, p.Total, "still counts the matches")

	_, p = get[legalForm](t, h, "/api/v1/legal-forms?country=XA&q=minis")
	require.Len(t, p.Items, 1)
	assert.Equal(t, "x_ministry", p.Items[0].Code)
}

func TestFeatureTheLegalFormListNeedsACountry(t *testing.T) {
	rec, _ := get[legalForm](t, referenceRouter(referenceWorld(t), &stated{allow: true}), "/api/v1/legal-forms")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	assert.Contains(t, rec.Body.String(), `"country"`)
}

type institutionType struct {
	Code, Name string
	Sector     struct{ Code, Name string }
}

func TestFeatureTheInstitutionTypeListShowsCurrentTypesBySector(t *testing.T) {
	authz := &stated{allow: true}
	h := referenceRouter(referenceWorld(t), authz)

	rec, p := get[institutionType](t, h, "/api/v1/institution-types?q=X%20")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:institution_type"}, authz.cans)
	got := []string{}
	for _, it := range p.Items {
		if strings.HasPrefix(it.Code, "x_") {
			got = append(got, it.Sector.Code+"/"+it.Code)
		}
	}
	assert.Equal(t, []string{"x_alpha/x_bank", "x_alpha/x_clinic", "x_beta/x_school"}, got,
		"by sector, then name; retired types and types of retired sectors are left out")
	assert.Equal(t, "X Alpha sector", p.Items[0].Sector.Name)
	assert.Equal(t, "X Bank", p.Items[0].Name)

	_, p = get[institutionType](t, h, "/api/v1/institution-types?sector=x_beta")
	require.Len(t, p.Items, 1)
	assert.Equal(t, "x_school", p.Items[0].Code)
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
}

func TestFeatureAFailedReadIsUnavailable(t *testing.T) {
	tx := referenceWorld(t)
	h := referenceRouter(tx, &stated{allow: true})
	_, err := tx.Exec(t.Context(), `SELECT 1/0`) // the transaction is now aborted
	require.Error(t, err)
	rec, _ := get[country](t, h, "/api/v1/countries")
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)
}
