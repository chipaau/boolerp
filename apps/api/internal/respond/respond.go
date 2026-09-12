// Package respond writes HTTP JSON responses. It exists as its own tiny, dependency-free package
// (like internal/module) so every package that writes an HTTP response — internal/httpapi and every
// module, including internal/auth, which httpapi itself depends on — shares the exact same helpers
// instead of each maintaining its own near-identical copy.
package respond

import (
	"encoding/json"
	"net/http"
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

// Error writes the common {"error": msg} shape at the given status.
func Error(w http.ResponseWriter, status int, msg string) {
	JSONBody(w, status, map[string]string{"error": msg})
}
