package auth

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/observability"
	"github.com/boolmv/erp/internal/respond"
)

// Middleware validates the Kratos session on each request and resolves the caller's users mirror —
// verifying it, never creating it (there is no self-registration; see RequireSession).
type Middleware struct {
	kratos *Kratos
	pool   *pgxpool.Pool
}

// NewMiddleware wires the session middleware.
func NewMiddleware(kratos *Kratos, pool *pgxpool.Pool) *Middleware {
	return &Middleware{kratos: kratos, pool: pool}
}

// RequireSession rejects unauthenticated requests (401) and authenticated-but-unknown ones (403),
// then puts the Principal into the request context (UC-AUTH-08).
//
// Authenticating with Kratos is not admission to this system: there is no self-registration, so a
// user exists only because provisioning or an invite created it. The mirror is refreshed here, never
// created — an identity Kratos happily issued a session for (today password/passkey/code, tomorrow
// an OIDC provider) gets 403 unless an operator or tenant admin already put them in platform.users.
func (m *Middleware) RequireSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie := r.Header.Get("Cookie")
		if cookie == "" {
			unauthorized(r.Context(), w)
			return
		}

		sess, err := m.kratos.Whoami(r.Context(), cookie)
		if err != nil {
			if errors.Is(err, ErrNoSession) {
				unauthorized(r.Context(), w)
				return
			}
			observability.LoggerFrom(r.Context()).Error("whoami failed", "err", err)
			respond.Error(r.Context(), w, http.StatusBadGateway, "auth upstream")
			return
		}
		if !sess.Active {
			unauthorized(r.Context(), w)
			return
		}

		user, err := m.sync(r.Context(), sess)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				m.denyUnadmitted(r.Context(), w, sess.Identity.ID)
				return
			}
			observability.LoggerFrom(r.Context()).Error("user mirror sync failed", "err", err)
			respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
			return
		}

		p := &Principal{ID: sess.Identity.ID, Email: user.Email, Name: user.Name}
		ctx := WithPrincipal(r.Context(), p)
		ctx = observability.WithLogger(ctx, observability.LoggerFrom(ctx).With("user_id", p.ID))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// denyUnadmitted answers 403 for a valid session whose subject is not an active platform user. Both
// causes are anomalies worth seeing in logs, and they mean different things operationally: "disabled"
// is a live session for an account someone switched off (session revocation didn't take, or hasn't
// yet), while a missing row means an identity exists that provisioning never created.
func (m *Middleware) denyUnadmitted(ctx context.Context, w http.ResponseWriter, identityID string) {
	reason := "not provisioned"
	if id, err := ParseUUID(identityID); err == nil {
		if u, err := sqlc.New(m.pool).GetUserByID(ctx, id); err == nil {
			reason = "user " + u.Status
		}
	}
	observability.LoggerFrom(ctx).Warn("session denied for unadmitted identity",
		"kratos_identity_id", identityID, "reason", reason)
	respond.Error(ctx, w, http.StatusForbidden, "no access")
}

// loginStampInterval is how coarse last_login_at is allowed to be. The column answers "when was this
// account last used", which nothing needs to the second — so the stamp is refreshed at most this
// often, and the overwhelming majority of requests do no write at all.
const loginStampInterval = 5 * time.Minute

// sync resolves the caller's mirror row, and writes ONLY when there is something to write.
//
// Admission is a question — does this subject have an active row — so it is asked with a SELECT. It
// used to be an UPDATE, which meant every authenticated request took a row lock (serialising a
// user's own concurrent requests), produced a dead tuple for vacuum, and made the API unable to
// serve reads against a replica. The write remains for the two cases that genuinely need it: the
// Kratos traits have drifted from the mirror, or the login stamp has gone stale.
func (m *Middleware) sync(ctx context.Context, sess *KratosSession) (sqlc.User, error) {
	id, err := ParseUUID(sess.Identity.ID)
	if err != nil {
		return sqlc.User{}, err
	}
	q := sqlc.New(m.pool)

	user, err := q.GetActiveUserForSession(ctx, id)
	if err != nil {
		return sqlc.User{}, err
	}

	t := sess.Identity.Traits
	params := sqlc.SyncUserOnLoginParams{
		ID:       id,
		Email:    t.Email,
		Name:     t.Name,
		NameI18n: nameI18n(t.NameI18n),
		Phone:    textOrNull(t.Phone),
	}
	if !needsSync(user, params) {
		return user, nil
	}
	// A racing request may do this too; the update is idempotent, so the loser simply rewrites the
	// same values.
	return q.SyncUserOnLogin(ctx, params)
}

// needsSync reports whether the stored mirror still matches Kratos, and whether the login stamp is
// fresh enough to leave alone.
func needsSync(user sqlc.User, fresh sqlc.SyncUserOnLoginParams) bool {
	if !user.LastLoginAt.Valid || time.Since(user.LastLoginAt.Time) > loginStampInterval {
		return true
	}
	return user.Email != fresh.Email ||
		user.Name != fresh.Name ||
		user.Phone != fresh.Phone ||
		!bytes.Equal(user.NameI18n, fresh.NameI18n)
}

func unauthorized(ctx context.Context, w http.ResponseWriter) {
	respond.Error(ctx, w, http.StatusUnauthorized, "unauthenticated")
}
