// Package proxy forwards the browser's /api/* requests to the API (C90, C98) as
// the signed-in person: it adds Authorization: Bearer with the session's access
// token, refreshing it shortly before it expires, and never passes the browser's
// cookie or its own Authorization header. net/http/httputil's ReverseProxy does
// the forwarding; golang.org/x/sync/singleflight makes concurrent requests of one
// session share a single refresh.
package proxy

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"golang.org/x/sync/singleflight"

	"github.com/boolmv/erp/apps/api/internal/bff/session"
	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

// RefreshBefore is how long before the access token expires the proxy refreshes
// it, so a token never expires on its way to the API (C98).
const RefreshBefore = time.Minute

// refreshTimeout bounds one refresh, which concurrent requests share, so it does
// not end with the request that started it.
const refreshTimeout = 10 * time.Second

// RefreshFunc exchanges a refresh token for new tokens (login.Handler.Refresh).
// It returns refused when Hydra refuses the refresh token.
type RefreshFunc func(ctx context.Context, old session.Tokens) (session.Tokens, error)

// Proxy forwards requests to the API.
type Proxy struct {
	sessions *session.Sessions
	refresh  RefreshFunc
	refused  error // the error RefreshFunc returns for a refused refresh token
	logger   *slog.Logger
	now      func() time.Time
	flight   singleflight.Group
	reverse  *httputil.ReverseProxy
}

type tokenKey struct{}

// New returns a proxy to api (such as http://api:8080) over transport. refused is
// the error refresh returns when Hydra refuses the refresh token.
func New(api *url.URL, transport http.RoundTripper, sessions *session.Sessions, refresh RefreshFunc, refused error, logger *slog.Logger) *Proxy {
	p := &Proxy{sessions: sessions, refresh: refresh, refused: refused, logger: logger, now: time.Now}
	p.reverse = &httputil.ReverseProxy{
		Transport: transport,
		// Rewrite starts from the browser's headers minus hop-by-hop and
		// X-Forwarded-* ones.
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(api)
			// The API sees the same Host as a direct request, so its origin checks
			// (C41) and later tenant resolution work unchanged.
			pr.Out.Host = pr.In.Host
			pr.Out.Header.Del("Cookie")
			pr.Out.Header.Del("Authorization")
			if token, ok := pr.In.Context().Value(tokenKey{}).(string); ok {
				pr.Out.Header.Set("Authorization", "Bearer "+token)
			}
			// The client as this BFF determined it (C40); the API trusts one hop.
			if ip := middleware.GetClientIP(pr.In.Context()); ip != "" {
				pr.Out.Header.Set("X-Forwarded-For", ip)
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			// The browser's only cookie is the BFF's session.
			resp.Header.Del("Set-Cookie")
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.WarnContext(r.Context(), "forwarding to the API failed", "error", err)
			problem.Error(w, r, http.StatusBadGateway, "The service is unavailable right now.")
		},
	}
	return p
}

// ServeHTTP forwards a signed-in request with the session's access token. A
// request without a session gets 401 (C98), so the app sends the browser to
// /auth/login; so does a session whose refresh token Hydra refuses, which is
// signed out first.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	in, ok, err := p.sessions.Current(ctx)
	if err != nil {
		p.logger.ErrorContext(ctx, "loading the session failed", "error", err)
		problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
		return
	}
	if !ok {
		problem.Error(w, r, http.StatusUnauthorized, "Sign in to continue.")
		return
	}
	if !in.Tokens.Expiry.After(p.now().Add(RefreshBefore)) {
		tokens, err := p.refreshShared(ctx, in)
		if errors.Is(err, p.refused) {
			p.logger.InfoContext(ctx, "refresh token refused; signing out", "account", in.Account)
			if err := p.sessions.SignOut(ctx); err != nil {
				p.logger.ErrorContext(ctx, "signing out failed", "error", err)
			}
			problem.Error(w, r, http.StatusUnauthorized, "Sign in to continue.")
			return
		}
		if err != nil {
			p.logger.WarnContext(ctx, "refreshing the access token failed", "error", err)
			problem.Error(w, r, http.StatusServiceUnavailable, "The service is unavailable right now.")
			return
		}
		in.Tokens = tokens
	}
	p.reverse.ServeHTTP(w, r.WithContext(context.WithValue(ctx, tokenKey{}, in.Tokens.Access)))
}

// refreshShared refreshes a session's tokens once for all its concurrent
// requests in this process. Inside, it first rereads the stored tokens, since
// another request may have just refreshed them; Hydra's grace period covers the
// same race across processes (C98).
func (p *Proxy) refreshShared(ctx context.Context, in session.SignedIn) (session.Tokens, error) {
	v, err, _ := p.flight.Do(in.TokensID, func() (any, error) {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), refreshTimeout)
		defer cancel()
		if cur, ok, err := p.sessions.Current(ctx); err == nil && ok &&
			cur.Tokens.Expiry.After(p.now().Add(RefreshBefore)) {
			return cur.Tokens, nil
		}
		tokens, err := p.refresh(ctx, in.Tokens)
		if err != nil {
			return session.Tokens{}, err
		}
		in.Tokens = tokens
		if err := p.sessions.SaveTokens(ctx, in); err != nil {
			return session.Tokens{}, err
		}
		return tokens, nil
	})
	if err != nil {
		return session.Tokens{}, err
	}
	return v.(session.Tokens), nil
}
