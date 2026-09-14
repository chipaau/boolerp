package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/observability"
	"github.com/boolmv/erp/internal/respond"
)

// AdminRoute registers an operator/admin-console handler that is authorized against a Cerbos
// resource before it ever runs. Every admin route must be registered THROUGH this helper rather than
// a raw r.Get/r.Post — the capability check is inside the wrapper itself, so a route added the
// ordinary chi way simply has no way to skip it (the fail-closed backstop sentinel-api's own ADR
// flagged as an unbuilt gap: a per-handler Cerbos call that's easy to forget).
//
// The handler signature below makes that a compile error for handlers written in this shape, but it
// can't stop a plain http.HandlerFunc being mounted alongside them, so the guarantee is enforced
// behaviourally instead: TestEveryAdminRouteIsAuthorizationGated walks each module's real route tree
// and fails if any /admin route answers a capability-less caller with anything but 403.
//
// Generic over D — each module's own (narrow) deps type — so AdminRoute stays a single shared
// platform helper without forcing every module's handlers to accept the whole platform-wide
// PlatformDeps bag; only pool and cerbos are needed here for the authorization check itself.
// resourceKind/action name the Cerbos resource + action (see docker/cerbos/policies) — action is
// typically "list", "get", "provision", "suspend", "reactivate", "archive", but is resource-specific
// per module.
func AdminRoute[D any](
	r chi.Router, method, pattern, resourceKind, action string,
	pool *pgxpool.Pool, cerbos *auth.Cerbos, deps D,
	handler func(w http.ResponseWriter, req *http.Request, d D, p auth.AuthzPrincipal),
) {
	r.Method(method, pattern, http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		principal, ok := auth.PrincipalFrom(req.Context())
		if !ok {
			respond.Error(req.Context(), w, http.StatusUnauthorized, "unauthenticated")
			return
		}
		userID, err := auth.ParseUUID(principal.ID)
		if err != nil {
			respond.Error(req.Context(), w, http.StatusInternalServerError, "bad principal id")
			return
		}

		azp, err := auth.BuildOperatorPrincipal(req.Context(), pool, userID)
		if err != nil {
			respond.Error(req.Context(), w, http.StatusInternalServerError, "internal")
			return
		}

		// Cerbos requires a non-empty resource id even for collection-level actions (list, provision)
		// that have no specific instance yet — "collection" is that placeholder; get/suspend/
		// reactivate/archive pass the real {id} URL param instead.
		resourceID := chi.URLParam(req, "id")
		if resourceID == "" {
			resourceID = "collection"
		}

		allowed, err := cerbos.Authorize(req.Context(), azp, auth.AuthzResource{Kind: resourceKind, ID: resourceID}, action)
		if err != nil {
			observability.LoggerFrom(req.Context()).Error("cerbos authorize", "err", err)
			respond.Error(req.Context(), w, http.StatusBadGateway, "authz upstream")
			return
		}
		if !allowed {
			respond.Error(req.Context(), w, http.StatusForbidden, "forbidden")
			return
		}

		handler(w, req, deps, azp)
	}))
}
