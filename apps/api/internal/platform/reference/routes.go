package reference

import (
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
// Cerbos decides first: reference:country list.
func (m *Module) countries(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", "reference:country"); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		l, ok := httpinput.ParseList(w, r, store.CountryListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListCountries(r.Context(), m.db, l)
		if err != nil {
			m.unavailable(w, r, "listing countries failed", err)
			return
		}
		items := make([]country, len(rows))
		for i, c := range rows {
			items[i] = country{c.Code, c.Alpha3, c.Name, c.PhonePrefix}
		}
		httpinput.WritePage(w, l, items, total)
	}
}

type legalForm struct {
	ID               string  `json:"id"`
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`
	IdentityDocument *string `json:"identityDocument"`
}

// legalForms answers a country's current legal forms (GET /api/v1/legal-forms?country=MV).
// Cerbos decides first: reference:legal_form list.
func (m *Module) legalForms(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", "reference:legal_form"); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		l, ok := httpinput.ParseList(w, r, store.LegalFormListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListLegalForms(r.Context(), m.db, l)
		if err != nil {
			m.unavailable(w, r, "listing legal forms failed", err)
			return
		}
		items := make([]legalForm, len(rows))
		for i, f := range rows {
			items[i] = legalForm{f.ID, f.Code, f.Name, f.Category, f.IdentityDocument}
		}
		httpinput.WritePage(w, l, items, total)
	}
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
// (GET /api/v1/institution-types). Cerbos decides first: reference:institution_type list.
func (m *Module) institutionTypes(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", "reference:institution_type"); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		l, ok := httpinput.ParseList(w, r, store.InstitutionTypeListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListInstitutionTypes(r.Context(), m.db, l)
		if err != nil {
			m.unavailable(w, r, "listing institution types failed", err)
			return
		}
		items := make([]institutionType, len(rows))
		for i, it := range rows {
			items[i] = institutionType{it.Code, it.Name, sector{it.SectorCode, it.SectorName}}
		}
		httpinput.WritePage(w, l, items, total)
	}
}

// unavailable logs a failed read and answers 503, never the error itself.
func (m *Module) unavailable(w http.ResponseWriter, r *http.Request, msg string, err error) {
	m.logger.ErrorContext(r.Context(), msg, "error", err)
	problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
}
