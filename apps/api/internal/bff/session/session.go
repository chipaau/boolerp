// Package session keeps the BFF's browser sessions (C90, C96, C98): the browser
// holds only an HttpOnly cookie with a random token, and the session lives in the
// session Redis. It configures scs (github.com/alexedwards/scs/v2) with its
// go-redis store; idle and absolute timeouts, token renewal at login, and
// destroying a session are scs's.
//
// Hydra's tokens are not in the scs session: scs saves the whole session at the
// end of every request (to extend the idle timeout), so a request that loaded
// the session before a refresh would write the old tokens back. They live in
// their own key instead, sealed (seal.go), written only at login and by a
// refresh (C98).
package session

import (
	"context"
	"crypto/rand"
	"encoding/base64"
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

// Session keys of a signed-in session; none of them changes after login.
const (
	keyAccount      = "account"       // the Kratos account ID (the ID token's sub)
	keyHydraSession = "hydra_session" // Hydra's login-session ID (sid), for logout (7e)
	keyLoginAt      = "login_at"      // Unix seconds; scs encodes values with gob
	keyTokensID     = "tokens_id"     // names the tokens' own key
)

// Settings configure sessions (from config.Session).
type Settings struct {
	// KeyPrefix starts every Redis key of this BFF instance, so instances sharing
	// one Redis keep their sessions apart (C97), such as "bff:erp-app:". Sessions
	// are under <prefix>session:, tokens under <prefix>tokens:.
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

// SignedIn is the state of a signed-in session.
type SignedIn struct {
	Account      string
	HydraSession string
	Tokens       Tokens
	// TokensID names the tokens' key; set by Current, and used by SaveTokens.
	TokensID string
}

// Sessions is the session manager plus the tokens' own keys.
type Sessions struct {
	*scs.SessionManager
	redis    *goredis.Client
	sealer   *Sealer
	prefix   string
	lifetime time.Duration
}

// New returns the sessions over the session Redis. onError answers a request
// whose session could not be loaded or saved (the store is unavailable).
func New(client *goredis.Client, sealer *Sealer, s Settings, onError func(http.ResponseWriter, *http.Request, error)) *Sessions {
	m := scs.New()
	m.Store = goredisstore.NewWithPrefix(client, s.KeyPrefix+"session:")
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
	return &Sessions{SessionManager: m, redis: client, sealer: sealer, prefix: s.KeyPrefix, lifetime: s.Lifetime}
}

// SignIn stores a completed login under a new session token, so a token planted
// before the login (session fixation) is worthless. The tokens get a new key
// that expires with the session's lifetime, and are listed under Hydra's login
// session, so back-channel logout can find them (C101).
func (s *Sessions) SignIn(ctx context.Context, in SignedIn) error {
	id := randomID()
	if err := s.writeTokens(ctx, in.Account, id, in.Tokens, s.lifetime); err != nil {
		return err
	}
	if in.HydraSession != "" {
		key := s.hydraSessionKey(in.HydraSession)
		_, err := s.redis.TxPipelined(ctx, func(p goredis.Pipeliner) error {
			p.SAdd(ctx, key, id)
			p.Expire(ctx, key, s.lifetime)
			return nil
		})
		if err != nil {
			return fmt.Errorf("session: listing under the Hydra session: %w", err)
		}
	}
	if err := s.RenewToken(ctx); err != nil {
		return fmt.Errorf("session: renewing the token: %w", err)
	}
	s.Put(ctx, keyAccount, in.Account)
	s.Put(ctx, keyHydraSession, in.HydraSession)
	s.Put(ctx, keyLoginAt, time.Now().Unix())
	s.Put(ctx, keyTokensID, id)
	return nil
}

// Current returns the signed-in state with the latest tokens, or false when the
// session is not signed in. A session whose tokens are gone or cannot be opened
// (the key was replaced) is signed out, so the browser signs in again (C96).
// An error means the session Redis is unavailable.
func (s *Sessions) Current(ctx context.Context) (SignedIn, bool, error) {
	account := s.GetString(ctx, keyAccount)
	id := s.GetString(ctx, keyTokensID)
	if account == "" || id == "" {
		return SignedIn{}, false, nil
	}
	sealed, err := s.redis.Get(ctx, s.tokensKey(id)).Bytes()
	if errors.Is(err, goredis.Nil) {
		return SignedIn{}, false, s.SignOut(ctx)
	}
	if err != nil {
		return SignedIn{}, false, fmt.Errorf("session: reading tokens: %w", err)
	}
	plaintext, err := s.sealer.Open(sealed, tokensAAD(account, id))
	if err != nil {
		return SignedIn{}, false, s.SignOut(ctx)
	}
	var tokens Tokens
	if err := json.Unmarshal(plaintext, &tokens); err != nil {
		return SignedIn{}, false, s.SignOut(ctx)
	}
	return SignedIn{
		Account:      account,
		HydraSession: s.GetString(ctx, keyHydraSession),
		Tokens:       tokens,
		TokensID:     id,
	}, true, nil
}

// SaveTokens replaces a session's tokens after a refresh, keeping the key's
// expiry (the session's absolute lifetime).
func (s *Sessions) SaveTokens(ctx context.Context, in SignedIn) error {
	return s.writeTokens(ctx, in.Account, in.TokensID, in.Tokens, goredis.KeepTTL)
}

// SignOut deletes the session's tokens, removes it from its Hydra login
// session's list, and destroys the session.
func (s *Sessions) SignOut(ctx context.Context) error {
	if id := s.GetString(ctx, keyTokensID); id != "" {
		_, err := s.redis.TxPipelined(ctx, func(p goredis.Pipeliner) error {
			p.Del(ctx, s.tokensKey(id))
			if sid := s.GetString(ctx, keyHydraSession); sid != "" {
				p.SRem(ctx, s.hydraSessionKey(sid), id)
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("session: deleting tokens: %w", err)
		}
	}
	return s.Destroy(ctx)
}

// EndHydraSession signs out every session of this BFF instance that belongs to
// a Hydra login session, after Hydra's back-channel logout (C101). It deletes
// their tokens; each session is then signed out on its next request (Current).
func (s *Sessions) EndHydraSession(ctx context.Context, hydraSession string) error {
	key := s.hydraSessionKey(hydraSession)
	ids, err := s.redis.SMembers(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("session: reading the Hydra session: %w", err)
	}
	keys := []string{key}
	for _, id := range ids {
		keys = append(keys, s.tokensKey(id))
	}
	if err := s.redis.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("session: ending the Hydra session: %w", err)
	}
	return nil
}

func (s *Sessions) writeTokens(ctx context.Context, account, id string, tokens Tokens, ttl time.Duration) error {
	plaintext, err := json.Marshal(tokens)
	if err != nil {
		return fmt.Errorf("session: %w", err)
	}
	sealed := s.sealer.Seal(plaintext, tokensAAD(account, id))
	if err := s.redis.Set(ctx, s.tokensKey(id), sealed, ttl).Err(); err != nil {
		return fmt.Errorf("session: storing tokens: %w", err)
	}
	return nil
}

func (s *Sessions) tokensKey(id string) string { return s.prefix + "tokens:" + id }

func (s *Sessions) hydraSessionKey(sid string) string { return s.prefix + "hydra-session:" + sid }

// tokensAAD binds sealed tokens to their account and key, so a record copied to
// another key or session does not open.
func tokensAAD(account, id string) string { return account + "\x00" + id }

// randomID returns 32 random bytes, base64url-encoded.
func randomID() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b) // crypto/rand.Read never fails (Go 1.24+)
	return base64.RawURLEncoding.EncodeToString(b)
}
