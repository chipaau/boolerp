package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/observability"
)

// AdminRoute registers an operator/admin-console handler that is authorized against the "tenant"
// resource before it ever runs. Every admin route must be registered THROUGH this helper rather than
// a raw r.Get/r.Post — the capability check is inside the wrapper itself, so a route added the
// ordinary chi way simply has no way to skip it (the fail-closed backstop sentinel-api's own ADR
// flagged as an unbuilt gap: a per-handler Cerbos call that's easy to forget). action names the
// Cerbos action on the "tenant" resource (see docker/cerbos/policies) — "list", "get", "provision",
// "suspend", "reactivate", "archive".
func AdminRoute(r chi.Router, method, pattern, action string, deps Deps, handler func(w http.ResponseWriter, req *http.Request, d Deps, p auth.AuthzPrincipal)) {
	r.Method(method, pattern, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		principal, ok := auth.PrincipalFrom(req.Context())
		if !ok {
			WriteJSON(w, http.StatusUnauthorized, `{"error":"unauthenticated"}`)
			return
		}
		userID, err := auth.ParseUUID(principal.ID)
		if err != nil {
			WriteJSON(w, http.StatusInternalServerError, `{"error":"bad principal id"}`)
			return
		}

		azp, err := auth.BuildOperatorPrincipal(req.Context(), deps.Pool, userID)
		if err != nil {
			WriteJSON(w, http.StatusInternalServerError, `{"error":"internal"}`)
			return
		}

		// Cerbos requires a non-empty resource id even for collection-level actions (list, provision)
		// that have no specific instance yet — "collection" is that placeholder; get/suspend/
		// reactivate/archive pass the real {id} URL param instead.
		resourceID := chi.URLParam(req, "id")
		if resourceID == "" {
			resourceID = "collection"
		}

		allowed, err := deps.Cerbos.Authorize(req.Context(), azp, auth.AuthzResource{Kind: "tenant", ID: resourceID}, action)
		if err != nil {
			observability.LoggerFrom(req.Context()).Error("cerbos authorize", "err", err)
			WriteJSON(w, http.StatusBadGateway, `{"error":"authz upstream"}`)
			return
		}
		if !allowed {
			WriteJSON(w, http.StatusForbidden, `{"error":"forbidden"}`)
			return
		}

		handler(w, req, deps, azp)
	}))
}
