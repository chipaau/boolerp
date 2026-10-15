package reference

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/reference/adapters/store"
)

// Routes returns the reference lists' routes, relative to where the edition mounts
// them (/api/v1), behind the Authenticated chain: reference data is not sensitive,
// so any authenticated caller may read it, a person or a machine client (C199).
func (m *Module) Routes(s platform.Services) func(chi.Router) {
	return func(r chi.Router) {
		r.Group(func(r chi.Router) {
			r.Use(s.Authenticated...)
			r.Get("/countries", m.countries(s.Authz))
			r.Get("/legal-forms", m.legalForms(s.Authz))
			r.Get("/institution-types", m.institutionTypes(s.Authz))
		})
	}
}

type country struct {
	Code        string `json:"code"`
	Alpha3      string `json:"alpha3"`
	Name        string `json:"name"`
	PhonePrefix string `json:"phonePrefix"`
}

// countries answers the current countries (GET /api/v1/countries), all in one page.
func (m *Module) countries(authz authorization.Authorizer) http.HandlerFunc {
	return list(m, authz, "reference:country", store.CountryListSpec,
		func(ctx context.Context, l httpinput.List) ([]country, int, error) {
			rows, total, err := store.ListCountries(ctx, m.db, l)
			items := make([]country, len(rows))
			for i, c := range rows {
				items[i] = country{c.Code, c.Alpha3, c.Name, c.PhonePrefix}
			}
			return items, total, err
		})
}

type legalForm struct {
	ID               string  `json:"id"`
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`
	IdentityDocument *string `json:"identityDocument"`
}

// legalForms answers a country's current legal forms (GET /api/v1/legal-forms?country=MV).
func (m *Module) legalForms(authz authorization.Authorizer) http.HandlerFunc {
	return list(m, authz, "reference:legal_form", store.LegalFormListSpec,
		func(ctx context.Context, l httpinput.List) ([]legalForm, int, error) {
			rows, total, err := store.ListLegalForms(ctx, m.db, l)
			items := make([]legalForm, len(rows))
			for i, f := range rows {
				items[i] = legalForm{f.ID, f.Code, f.Name, f.Category, f.IdentityDocument}
			}
			return items, total, err
		})
}

type sector struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type institutionType struct {
	Code   string `json:"code"`
	Name   string `json:"name"`
	Sector sector `json:"sector"`
}

// institutionTypes answers the current institution types with their sectors
// (GET /api/v1/institution-types).
func (m *Module) institutionTypes(authz authorization.Authorizer) http.HandlerFunc {
	return list(m, authz, "reference:institution_type", store.InstitutionTypeListSpec,
		func(ctx context.Context, l httpinput.List) ([]institutionType, int, error) {
			rows, total, err := store.ListInstitutionTypes(ctx, m.db, l)
			items := make([]institutionType, len(rows))
			for i, it := range rows {
				items[i] = institutionType{it.Code, it.Name, sector{it.SectorCode, it.SectorName}}
			}
			return items, total, err
		})
}

// list answers one page of a reference list (C68, C69): Cerbos decides first (list on
// kind), then the parameters are read against spec and the page is read with read.
func list[T any](m *Module, authz authorization.Authorizer, kind string, spec httpinput.ListSpec,
	read func(ctx context.Context, l httpinput.List) ([]T, int, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", kind); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		l, ok := httpinput.ParseList(w, r, spec)
		if !ok {
			return
		}
		items, total, err := read(r.Context(), l)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "reading a reference list failed", "kind", kind, "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(struct {
			Items    []T `json:"items"`
			Page     int `json:"page"`
			PageSize int `json:"pageSize"`
			Total    int `json:"total"`
		}{items, l.Page, l.PageSize, total})
	}
}
