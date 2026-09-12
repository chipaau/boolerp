package auth

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Bool-Maldives/erp/internal/db/sqlc"
	"github.com/Bool-Maldives/erp/internal/module"
	"github.com/Bool-Maldives/erp/internal/observability"
	"github.com/Bool-Maldives/erp/internal/respond"
)

// Register builds this package's own module.Module: GET /me, the current user's own profile.
// Takes pool + cerbos directly (mirrors httpapi.AdminRoute's own shape) — that's all this handler
// needs, no platform-wide deps bag required. RLSTables is empty: users is a platform table, outside
// the tenant RLS regime (see .claude/rules/tenancy.md).
func Register(pool *pgxpool.Pool, cerbos *Cerbos) module.Module {
	return module.Module{
		Name: "auth",
		Mount: func(r chi.Router) {
			r.Get("/me", me(pool, cerbos))
		},
	}
}

type meResponse struct {
	ID       string          `json:"id"`
	Email    string          `json:"email"`
	Name     string          `json:"name"`
	NameI18n json.RawMessage `json:"name_i18n"`
	Phone    *string         `json:"phone,omitempty"`
	Status   string          `json:"status"`
}

// me returns the current user. Exercises the full backbone: session (whoami) → JIT-upsert (in the
// session middleware) → authz (Cerbos scaffold policy) → DB read — this handler owns the read that
// mirrors what Middleware.upsert already writes to the same users table.
func me(pool *pgxpool.Pool, cerbos *Cerbos) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p, ok := PrincipalFrom(r.Context())
		if !ok {
			respond.Error(w, http.StatusInternalServerError, "no principal")
			return
		}

		allowed, err := cerbos.AllowSelfProfileRead(r.Context(), p.ID)
		if err != nil {
			observability.LoggerFrom(r.Context()).Error("cerbos check", "err", err)
			respond.Error(w, http.StatusBadGateway, "authz upstream")
			return
		}
		if !allowed {
			respond.Error(w, http.StatusForbidden, "forbidden")
			return
		}

		id, err := ParseUUID(p.ID)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "bad principal id")
			return
		}
		u, err := sqlc.New(pool).GetUserByID(r.Context(), id)
		if err != nil {
			observability.LoggerFrom(r.Context()).Error("get user", "err", err)
			respond.Error(w, http.StatusInternalServerError, "internal")
			return
		}

		resp := meResponse{ID: p.ID, Email: u.Email, Name: u.Name, NameI18n: u.NameI18n, Status: u.Status}
		if u.Phone.Valid {
			resp.Phone = &u.Phone.String
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}
