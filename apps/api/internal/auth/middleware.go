package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/db/sqlc"
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
			slog.Error("whoami failed", "err", err)
			writeErr(w, http.StatusBadGateway, "auth upstream")
			return
		}
		if !sess.Active {
			unauthorized(w)
			return
		}

		user, err := m.upsert(r.Context(), sess)
		if err != nil {
			slog.Error("jit upsert failed", "err", err)
			writeErr(w, http.StatusInternalServerError, "internal")
			return
		}

		p := &Principal{ID: sess.Identity.ID, Email: user.Email, Name: user.Name}
		next.ServeHTTP(w, r.WithContext(WithPrincipal(r.Context(), p)))
	})
}

func (m *Middleware) upsert(ctx context.Context, sess *KratosSession) (sqlc.User, error) {
	id, err := ParseUUID(sess.Identity.ID)
	if err != nil {
		return sqlc.User{}, err
	}
	t := sess.Identity.Traits
	return sqlc.New(m.pool).UpsertUser(ctx, sqlc.UpsertUserParams{
		ID:     id,
		Email:  t.Email,
		Name:   t.Name,
		NameDv: textOrNull(t.NameDv),
		Phone:  textOrNull(t.Phone),
	})
}

func unauthorized(w http.ResponseWriter) { writeErr(w, http.StatusUnauthorized, "unauthenticated") }

func writeErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"error":"` + msg + `"}`))
}
