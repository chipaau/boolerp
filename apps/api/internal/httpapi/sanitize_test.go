package httpapi_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/boolmv/erp/internal/httpapi"
)

// bodyReachingHandler runs one request through SanitizeBody and returns what the handler received.
func bodyReachingHandler(t *testing.T, contentType, body string) (string, int) {
	t.Helper()
	var got string
	h := httpapi.SanitizeBody(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		got = string(b)
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodPost, "/anything", strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return got, rec.Code
}

func TestSanitizeBody_TrimsStringsAnywhereInTheBody(t *testing.T) {
	got, code := bodyReachingHandler(t, "application/json",
		`{"name":"  Malé City Council  ","nested":{"slug":"\tmalecouncil\n"},"tags":["  a  ","b "]}`)
	if code != http.StatusOK {
		t.Fatalf("status: %d", code)
	}

	var v struct {
		Name   string                `json:"name"`
		Nested struct{ Slug string } `json:"nested"`
		Tags   []string              `json:"tags"`
	}
	if err := json.Unmarshal([]byte(got), &v); err != nil {
		t.Fatalf("decode %q: %v", got, err)
	}
	if v.Name != "Malé City Council" {
		t.Errorf("top-level string not trimmed: %q", v.Name)
	}
	if v.Nested.Slug != "malecouncil" {
		t.Errorf("nested string not trimmed: %q", v.Nested.Slug)
	}
	if v.Tags[0] != "a" || v.Tags[1] != "b" {
		t.Errorf("array elements not trimmed: %q", v.Tags)
	}
}

// Whitespace can be deliberate in a secret, and silently altering one turns a correct credential
// into a failing login with nothing to explain why.
func TestSanitizeBody_LeavesSensitiveFieldsUntouched(t *testing.T) {
	got, _ := bodyReachingHandler(t, "application/json", `{"password":"  hunter2  ","name":"  x  "}`)

	var v map[string]any
	if err := json.Unmarshal([]byte(got), &v); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if v["password"] != "  hunter2  " {
		t.Errorf("password must not be trimmed, got %q", v["password"])
	}
	if v["name"] != "x" {
		t.Errorf("ordinary field should still be trimmed, got %q", v["name"])
	}
}

// Re-encoding the body must not change the data. Decoding JSON numbers into float64 would silently
// round a large int64 — an id, or money in minor units — into a different number.
func TestSanitizeBody_PreservesLargeNumbersExactly(t *testing.T) {
	const big = 9007199254740993 // 2^53 + 1: not representable as a float64
	got, _ := bodyReachingHandler(t, "application/json", `{"id":9007199254740993,"rate":1.10}`)

	if !strings.Contains(got, "9007199254740993") {
		t.Fatalf("large integer was not preserved: %s", got)
	}
	var v struct {
		ID json.Number `json:"id"`
	}
	if err := json.Unmarshal([]byte(got), &v); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if v.ID.String() != "9007199254740993" {
		t.Fatalf("want %d preserved, got %s", big, v.ID)
	}
}

// Rejecting a malformed body is the handler's decision — it reports its own 400 with its own
// message — so the original bytes must arrive untouched rather than being swallowed here.
func TestSanitizeBody_PassesMalformedJSONThroughUnchanged(t *testing.T) {
	const malformed = `{"name": "unclosed`
	got, code := bodyReachingHandler(t, "application/json", malformed)
	if code != http.StatusOK {
		t.Fatalf("middleware should not reject; got %d", code)
	}
	if got != malformed {
		t.Fatalf("want the original bytes forwarded, got %q", got)
	}
}

func TestSanitizeBody_IgnoresNonJSONBodies(t *testing.T) {
	const form = "name=  spaced  "
	got, _ := bodyReachingHandler(t, "application/x-www-form-urlencoded", form)
	if got != form {
		t.Fatalf("a body that isn't JSON must pass through untouched, got %q", got)
	}
}

func TestSanitizeBody_AcceptsJSONSuffixContentTypes(t *testing.T) {
	got, _ := bodyReachingHandler(t, "application/merge-patch+json; charset=utf-8", `{"name":"  x  "}`)
	if !strings.Contains(got, `"x"`) {
		t.Fatalf("+json content type should be sanitized, got %q", got)
	}
}

// Handlers decode JSON whatever Content-Type says, so gating on the header would let a client skip
// sanitizing by simply omitting it. What matters is whether the body parses.
func TestSanitizeBody_SanitizesJSONWithNoContentType(t *testing.T) {
	got, _ := bodyReachingHandler(t, "", `{"name":"  x  "}`)
	if !strings.Contains(got, `"x"`) {
		t.Fatalf("JSON without a Content-Type must still be sanitized, got %q", got)
	}
}

// An upload must stream past rather than be buffered to be inspected.
func TestSanitizeBody_SkipsStreamedContentTypes(t *testing.T) {
	const payload = `{"name":"  untouched  "}`
	for _, ct := range []string{"multipart/form-data; boundary=x", "application/octet-stream", "image/png"} {
		got, _ := bodyReachingHandler(t, ct, payload)
		if got != payload {
			t.Fatalf("%s body must pass through untouched, got %q", ct, got)
		}
	}
}

// No handler can be made to buffer an unbounded body by forgetting its own limit.
func TestSanitizeBody_RejectsOversizedBodies(t *testing.T) {
	huge := `{"name":"` + strings.Repeat("a", 2<<20) + `"}`
	reached := false
	h := httpapi.SanitizeBody(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodPost, "/anything", bytes.NewReader([]byte(huge)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("want 413, got %d", rec.Code)
	}
	if reached {
		t.Fatal("an oversized body must not reach the handler")
	}
}

func TestSanitizeBody_IgnoresEmptyBodies(t *testing.T) {
	h := httpapi.SanitizeBody(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/anything", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200 for a bodyless request, got %d", rec.Code)
	}
}
