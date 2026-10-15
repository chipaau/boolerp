package reference

import (
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/reference/adapters/store"
)

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
		l, ok := request.ParseList(w, r, store.CountryListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListCountries(r.Context(), m.db, l)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing countries failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]country, len(rows))
		for i, c := range rows {
			items[i] = country{c.Code, c.Alpha3, c.Name, c.PhonePrefix}
		}
		response.Page(w, r, l, items, total)
	}
}
