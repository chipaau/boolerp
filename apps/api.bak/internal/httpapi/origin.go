package httpapi

import (
	"net/http"
	"net/url"

	"github.com/boolmv/erp/internal/observability"
	"github.com/boolmv/erp/internal/respond"
)

// RequireSameOrigin refuses a state-changing request whose Origin is not the host it was sent to.
//
// The session cookie is scoped to the parent domain (.bool.mv) so it works across tenant subdomains,
// which is deliberate — but it means SameSite=Lax does not separate siblings: every *.bool.mv host is
// "same site" to a browser. A page on one tenant's subdomain can therefore issue authenticated,
// state-changing requests to another, or to the operator API, carrying the victim's cookie. SameSite
// still blocks genuinely external sites; this closes the sibling case it cannot see.
//
// Only unsafe methods are checked. A cross-origin GET is already contained: we send no CORS headers,
// so a browser will not let the calling page read the response. A POST's side effects happen whether
// or not the attacker can read the reply, which is the whole point of CSRF.
//
// A missing Origin is allowed: non-browser clients (curl, server-to-server, the e2e harness) don't
// send one, and browsers always do on unsafe cross-origin requests. Hosts are compared without the
// scheme, because TLS terminates at the proxy — the API sees http:// while the browser reported
// https://, and comparing schemes would reject every real request in production.
func RequireSameOrigin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isSafeMethod(r.Method) {
			next.ServeHTTP(w, r)
			return
		}
		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		u, err := url.Parse(origin)
		if err != nil || u.Host == "" || u.Host != r.Host {
			observability.LoggerFrom(r.Context()).Warn("cross-origin write refused",
				"origin", origin, "host", r.Host, "method", r.Method, "path", r.URL.Path)
			respond.Error(r.Context(), w, http.StatusForbidden, "cross-origin request refused")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func isSafeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}
