package reference

import (
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/reference/adapters/store"
)

type geographyType struct {
	ID    string `json:"id"`
	Code  string `json:"code"`
	Name  string `json:"name"`
	Level int    `json:"level"`
}

// geographyTypes answers a country's address levels (GET /api/v1/geography-types?country=MV,
// C215): a form shows a picker or a text field for each, labelled by its name. Cerbos
// decides first: reference:geography_type list.
func (m *Module) geographyTypes(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", "reference:geography_type"); err != nil {
			authorization.WriteError(w, r, m.logger, err)
			return
		}
		l, ok := request.ParseList(w, r, store.GeographyTypeListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListGeographyTypes(r.Context(), m.db, l)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing geography types failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]geographyType, len(rows))
		for i, t := range rows {
			items[i] = geographyType{t.ID, t.Code, t.Name, t.Level}
		}
		response.Page(w, r, l, items, total)
	}
}
