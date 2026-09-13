// Package respond writes HTTP JSON responses. It exists as its own tiny, dependency-free package
// (like internal/module) so every package that writes an HTTP response — internal/httpapi and every
// module, including internal/auth, which httpapi itself depends on — shares the exact same helpers
// instead of each maintaining its own near-identical copy.
package respond

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
)

// JSON writes a literal JSON body — for small fixed responses, e.g. {"status":"ok"}.
func JSON(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(body))
}

// JSONBody encodes v as the JSON response body.
func JSONBody(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Error writes {"error": msg, "request_id": ...} at the given status. request_id is chi's own
// per-request id (middleware.RequestID, set unconditionally — unlike an OTel trace id, which only
// exists when tracing is actually configured) — the one identifier that's always present, always
// shown to the caller, and always in the matching log lines (observability.RequestLogger attaches
// the same id to the request-scoped logger), so a user-reported error id is enough to find both the
// request and its logs. It's also attached to the active span (see RequestLogger), so the same id
// works the other direction too when tracing is on.
func Error(ctx context.Context, w http.ResponseWriter, status int, msg string) {
	JSONBody(w, status, map[string]string{"error": msg, "request_id": middleware.GetReqID(ctx)})
}
