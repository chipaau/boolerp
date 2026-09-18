package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"strings"
)

// Every request body is capped, but not at the same size — a single limit is either too small for an
// upload or too large to buffer. Individual routes may still cap themselves tighter.
const (
	// maxInspectableBody bounds bodies this middleware reads into memory whole.
	maxInspectableBody = 1 << 20 // 1 MiB
	// maxStreamedBody bounds uploads, which are never buffered here — the handler consumes them as a
	// stream. Generous enough for a scanned receipt or signed PDF, finite so nothing is unbounded.
	maxStreamedBody = 16 << 20 // 16 MiB
)

// sensitiveFields are never trimmed: leading or trailing whitespace can be deliberate in a secret,
// and silently altering one turns a correct credential into a failing login with no explanation.
// (Kratos owns credentials, so nothing here should carry one today — this keeps that true by
// construction rather than by assumption.)
var sensitiveFields = map[string]bool{
	"password": true, "password_confirmation": true, "secret": true,
	"token": true, "access_token": true, "refresh_token": true, "api_key": true,
}

// SanitizeBody trims leading and trailing whitespace from every string in a JSON request body, for
// every route, and caps the body's size. Doing it here rather than per-field means " Malé City
// Council " can't reach the database through whichever handler forgot to trim, and validators see
// "   " as the empty value it is instead of a present-but-blank one.
//
// Deliberately NOT HTML-escaping or stripping tags. Encoding belongs at output, where the target
// context (HTML body, attribute, JS, SQL) decides the rule; doing it on input corrupts stored data
// permanently — a tenant named "Smith & Sons" would live in Postgres as "Smith &amp; Sons" — and
// still wouldn't protect a consumer that renders into a different context.
//
// Whether a body is JSON is decided by PARSING it, not by trusting Content-Type. Handlers decode
// with json.Decoder regardless of the declared type, so gating on the header would have let a client
// skip sanitizing entirely just by omitting it. Bodies that don't parse pass through untouched —
// rejecting a malformed body is the handler's decision, and it already reports that as a 400 with
// its own message — as do streamed types (uploads), which must not be buffered to be inspected.
func SanitizeBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body == nil || r.ContentLength == 0 {
			next.ServeHTTP(w, r)
			return
		}

		// Cap BEFORE deciding whether to inspect. Returning early for streamed types skipped the cap
		// entirely, so the bodies most worth bounding — uploads — were the only unbounded ones, which
		// is the opposite of what this middleware claimed to do.
		if isStreamedContentType(r) {
			r.Body = http.MaxBytesReader(w, r.Body, maxStreamedBody)
			next.ServeHTTP(w, r)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxInspectableBody)
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			// Over the cap, or the client vanished mid-upload. MaxBytesReader has already set the
			// response up for 413; saying so explicitly beats letting the handler fail confusingly.
			http.Error(w, `{"error":"request body too large"}`, http.StatusRequestEntityTooLarge)
			return
		}

		cleaned, ok := trimJSON(raw)
		if !ok {
			// Unparseable — hand the ORIGINAL bytes on so the handler's own error path runs.
			r.Body = io.NopCloser(bytes.NewReader(raw))
			next.ServeHTTP(w, r)
			return
		}

		r.Body = io.NopCloser(bytes.NewReader(cleaned))
		r.ContentLength = int64(len(cleaned))
		next.ServeHTTP(w, r)
	})
}

// isStreamedContentType reports bodies that must not be read into memory to be examined — file
// uploads and raw binary. Everything else is cheap enough to inspect, and is only rewritten if it
// actually turns out to be JSON.
func isStreamedContentType(r *http.Request) bool {
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil {
		return false
	}
	return strings.HasPrefix(mediaType, "multipart/") ||
		mediaType == "application/octet-stream" ||
		strings.HasPrefix(mediaType, "image/") ||
		strings.HasPrefix(mediaType, "video/") ||
		strings.HasPrefix(mediaType, "audio/")
}

// trimJSON re-encodes the body with every string trimmed. Reports false when the input isn't valid
// JSON, leaving the caller to pass the original through untouched.
func trimJSON(raw []byte) ([]byte, bool) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	// UseNumber keeps numeric literals as written. Without it every number decodes to float64, and
	// re-encoding would quietly round a large int64 — an id or a money value — into a different one.
	dec.UseNumber()

	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, false
	}
	out, err := json.Marshal(trimValue(v, ""))
	if err != nil {
		return nil, false
	}
	return out, true
}

// trimValue walks the decoded body. key is the field the value came from, so a sensitive one can be
// left exactly as sent.
func trimValue(v any, key string) any {
	switch t := v.(type) {
	case string:
		if sensitiveFields[strings.ToLower(key)] {
			return t
		}
		return strings.TrimSpace(t)
	case map[string]any:
		for k, val := range t {
			t[k] = trimValue(val, k)
		}
		return t
	case []any:
		for i, val := range t {
			// Elements inherit the key of the array they sit in, so a list of secrets stays untouched.
			t[i] = trimValue(val, key)
		}
		return t
	default:
		return v
	}
}
