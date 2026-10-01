// Package session keeps the BFF's browser sessions (C90, C96): the browser holds
// only an HttpOnly cookie with a random token, and the session lives in the
// session Redis. It configures scs (github.com/alexedwards/scs/v2) with its
// go-redis store; idle and absolute timeouts, token renewal at login, and
// destroying a session are scs's. Hydra's tokens are kept sealed (seal.go).
package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/alexedwards/scs/goredisstore"
	"github.com/alexedwards/scs/v2"
	goredis "github.com/redis/go-redis/v9"
)

// Cookie names: __Host- makes browsers accept the cookie only when it is
// Secure, host-only, and Path=/ (C96), which plain-HTTP development cannot use.
const (
	CookieName        = "__Host-session"
	CookieNameNoHTTPS = "session"
)

// Session keys of a signed-in session.
const (
	keyAccount      = "account"       // the Kratos account ID (the ID token's sub)
	keyHydraSession = "hydra_session" // Hydra's login-session ID (sid), for logout (7e)
	keyLoginAt      = "login_at"      // Unix seconds; scs encodes values with gob
	keyTokens       = "tokens"        // Tokens, sealed
)

// Settings configure sessions (from config.Session).
type Settings struct {
	// KeyPrefix starts every session's Redis key, so BFF instances sharing one
	// Redis keep their sessions apart (C97), such as "bff:erp-app:session:".
	KeyPrefix    string
	IdleTimeout  time.Duration // ends a session after this long without a request
	Lifetime     time.Duration // ends a session this long after it started
	CookieSecure bool          // HTTPS only; off only for plain-HTTP development
}

// Tokens are Hydra's tokens for a signed-in session. They never reach the
// browser or the logs.
type Tokens struct {
	Access  string    `json:"access"`
	Refresh string    `json:"refresh"`
	IDToken string    `json:"id_token"` // the id_token_hint for logout (7e)
	Expiry  time.Time `json:"expiry"`   // when Access expires
}

// SignedIn is the state a login stores.
type SignedIn struct {
	Account      string
	HydraSession string
	Tokens       Tokens
}

// Sessions is the session manager plus the sealer for the tokens.
type Sessions struct {
	*scs.SessionManager
	sealer *Sealer
}

// New returns the sessions over the session Redis. onError answers a request
// whose session could not be loaded or saved (the store is unavailable).
func New(client *goredis.Client, sealer *Sealer, s Settings, onError func(http.ResponseWriter, *http.Request, error)) *Sessions {
	m := scs.New()
	m.Store = goredisstore.NewWithPrefix(client, s.KeyPrefix)
	// Only a SHA-256 hash of each token is used as the Redis key, so reading Redis
	// does not give anyone a usable cookie.
	m.HashTokenInStore = true
	m.IdleTimeout = s.IdleTimeout
	m.Lifetime = s.Lifetime
	m.Cookie.Name = CookieNameNoHTTPS
	if s.CookieSecure {
		m.Cookie.Name = CookieName
	}
	m.Cookie.Path = "/"
	m.Cookie.HttpOnly = true // never readable by JavaScript
	// Lax: sent on the top-level navigation back from Hydra to /auth/callback,
	// not on cross-site subrequests.
	m.Cookie.SameSite = http.SameSiteLaxMode
	m.Cookie.Secure = s.CookieSecure
	// A browser-session cookie (no Expires): closing the browser ends the app
	// session; the Kratos session then signs the person back in (C96).
	m.Cookie.Persist = false
	// No Domain: the cookie belongs to the exact host it was set on, so one
	// tenant's domain never receives another's cookie.
	m.ErrorFunc = onError
	return &Sessions{SessionManager: m, sealer: sealer}
}

// SignIn stores a completed login under a new session token, so a token planted
// before the login (session fixation) is worthless.
func (s *Sessions) SignIn(ctx context.Context, in SignedIn) error {
	tokens, err := json.Marshal(in.Tokens)
	if err != nil {
		return fmt.Errorf("session: %w", err)
	}
	if err := s.RenewToken(ctx); err != nil {
		return fmt.Errorf("session: renewing the token: %w", err)
	}
	s.Put(ctx, keyAccount, in.Account)
	s.Put(ctx, keyHydraSession, in.HydraSession)
	s.Put(ctx, keyLoginAt, time.Now().Unix())
	s.Put(ctx, keyTokens, s.sealer.Seal(tokens, in.Account))
	return nil
}

// Current returns the signed-in state, or false when the session is not signed
// in. A session whose tokens cannot be opened (the key was replaced) is
// destroyed and counts as signed out, so the browser signs in again (C96).
func (s *Sessions) Current(ctx context.Context) (SignedIn, bool, error) {
	account := s.GetString(ctx, keyAccount)
	sealed, _ := s.Get(ctx, keyTokens).([]byte)
	if account == "" || sealed == nil {
		return SignedIn{}, false, nil
	}
	plaintext, err := s.sealer.Open(sealed, account)
	if errors.Is(err, ErrUnreadable) {
		return SignedIn{}, false, s.Destroy(ctx)
	}
	var tokens Tokens
	if err := json.Unmarshal(plaintext, &tokens); err != nil {
		return SignedIn{}, false, s.Destroy(ctx)
	}
	return SignedIn{Account: account, HydraSession: s.GetString(ctx, keyHydraSession), Tokens: tokens}, true, nil
}
