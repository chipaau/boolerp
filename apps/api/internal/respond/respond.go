// Package respond writes HTTP JSON responses. It exists as its own tiny, dependency-free package
// (like internal/module) so every package that writes an HTTP response — internal/httpapi and every
// module, including internal/auth, which httpapi itself depends on — shares the exact same helpers
// instead of each maintaining its own near-identical copy.
package respond

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
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
//
// It encodes into a buffer BEFORE touching the ResponseWriter. Encoding straight into w commits the
// status line first, so a value that fails to marshal — an unmarshalable type, a NaN float, anything
// reachable through the map[string]any payloads handlers build — would send "200 OK" followed by a
// truncated body, with the error silently discarded. Buffering keeps that failure recoverable into
// an honest 500.
func JSONBody(w http.ResponseWriter, status int, v any) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		slog.Default().Error("response encoding failed", "err", err, "intended_status", status)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"internal"}` + "\n"))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
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

// FieldErrors maps a request field name to everything wrong with it. Several problems per field,
// and several fields at once, so one round-trip tells the caller everything to fix rather than
// revealing the next fault only after correcting the last.
type FieldErrors map[string][]string

// Add records a problem with one field.
func (f FieldErrors) Add(field, msg string) { f[field] = append(f[field], msg) }

// Any reports whether anything failed validation.
func (f FieldErrors) Any() bool { return len(f) > 0 }

// Invalid writes a 422 whose body is the standard {"error", "request_id"} envelope plus an "errors"
// map of field -> messages:
//
//	{"error":"validation failed","request_id":"…","errors":{"slug":["is reserved"]}}
//
// 422 (not 400) means "well-formed request, semantically unacceptable content" — a body that isn't
// JSON at all stays a 400, since there were no fields to validate. The envelope keeps `error` and
// `request_id` so existing clients keep working; `errors` follows Laravel's field->messages shape
// the frontend already knows how to render.
func Invalid(ctx context.Context, w http.ResponseWriter, errs FieldErrors) {
	JSONBody(w, http.StatusUnprocessableEntity, map[string]any{
		"error":      "validation failed",
		"request_id": middleware.GetReqID(ctx),
		"errors":     errs,
	})
}
