package auth

import (
	"context"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/db/sqlc"
	"github.com/boolmv/goerp/internal/observability"
	"github.com/boolmv/goerp/internal/respond"
)

// Middleware validates the Kratos session on each request and JIT-upserts the users mirror.
type Middleware struct {
	kratos *Kratos
	pool   *pgxpool.Pool
}

// NewMiddleware wires the session middleware.
func NewMiddleware(kratos *Kratos, pool *pgxpool.Pool) *Middleware {
	return &Middleware{kratos: kratos, pool: pool}
}

// RequireSession rejects unauthenticated requests (401). On success it JIT-upserts the user and
// puts the Principal into the request context (UC-AUTH-08).
func (m *Middleware) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie := r.Header.Get("Cookie")
		if cookie == "" {
			unauthorized(w)
			return
		}

		sess, err := m.kratos.Whoami(r.Context(), cookie)
		if err != nil {
			if errors.Is(err, ErrNoSession) {
				unauthorized(w)
				return
			}
			observability.LoggerFrom(r.Context()).Error("whoami failed", "err", err)
			respond.Error(w, http.StatusBadGateway, "auth upstream")
			return
		}
		if !sess.Active {
			unauthorized(w)
			return
		}

		user, err := m.upsert(r.Context(), sess)
		if err != nil {
			observability.LoggerFrom(r.Context()).Error("jit upsert failed", "err", err)
			respond.Error(w, http.StatusInternalServerError, "internal")
			return
		}

		p := &Principal{ID: sess.Identity.ID, Email: user.Email, Name: user.Name}
		ctx := WithPrincipal(r.Context(), p)
		ctx = observability.WithLogger(ctx, observability.LoggerFrom(ctx).With("user_id", p.ID))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (m *Middleware) upsert(ctx context.Context, sess *KratosSession) (sqlc.User, error) {
	id, err := ParseUUID(sess.Identity.ID)
	if err != nil {
		return sqlc.User{}, err
	}
	t := sess.Identity.Traits
	return sqlc.New(m.pool).UpsertUser(ctx, sqlc.UpsertUserParams{
		ID:       id,
		Email:    t.Email,
		Name:     t.Name,
		NameI18n: nameI18n(t.NameI18n),
		Phone:    textOrNull(t.Phone),
	})
}

func unauthorized(w http.ResponseWriter) { respond.Error(w, http.StatusUnauthorized, "unauthenticated") }
