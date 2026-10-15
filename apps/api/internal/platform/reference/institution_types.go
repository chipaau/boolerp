package reference

import (
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/reference/adapters/store"
)

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
		l, ok := request.ParseList(w, r, store.InstitutionTypeListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListInstitutionTypes(r.Context(), m.db, l)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing institution types failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]institutionType, len(rows))
		for i, it := range rows {
			items[i] = institutionType{it.Code, it.Name, sector{it.SectorCode, it.SectorName}}
		}
		response.Page(w, r, l, items, total)
	}
}
