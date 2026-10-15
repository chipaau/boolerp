package reference

import (
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/reference/adapters/store"
)

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
			authorization.WriteError(w, r, m.logger, err)
			return
		}
		l, ok := request.ParseList(w, r, store.LegalFormListSpec)
		if !ok {
			return
		}
		rows, total, err := store.ListLegalForms(r.Context(), m.db, l)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing legal forms failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]legalForm, len(rows))
		for i, f := range rows {
			items[i] = legalForm{f.ID, f.Code, f.Name, f.Category, f.IdentityDocument}
		}
		response.Page(w, r, l, items, total)
	}
}
