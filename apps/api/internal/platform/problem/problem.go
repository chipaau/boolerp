// Package problem writes RFC 9457 problem details, the JSON error format for
// every error response the API produces (C35, C37).
//
// https://www.rfc-editor.org/rfc/rfc9457
//
// No maintained Go library adds more than this struct, so it is written on the
// standard library (a documented gap under the framework-first rule).
package problem

import (
	"encoding/json"
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
)

// ContentType is the media type RFC 9457 registers for problem details.
const ContentType = "application/problem+json"

// Details is an RFC 9457 problem details object.
type Details struct {
	// Type is a URI identifying the problem type. "about:blank" means the
	// problem has no semantics beyond the HTTP status code (RFC 9457 §4.2.1).
	Type string `json:"type"`
	// Title is a short summary of the problem type. For "about:blank" it is
	// the HTTP status phrase.
	Title string `json:"title"`
	// Status repeats the HTTP status code, for clients that lose the header.
	Status int `json:"status"`
	// Detail explains this occurrence. It must be safe to show to the client:
	// never include internal errors, stack traces, or private data.
	Detail string `json:"detail,omitempty"`
	// Instance identifies this occurrence: the request ID as a URN, the same
	// value as the X-Request-Id header and the request_id log attribute.
	Instance string `json:"instance,omitempty"`
}

// New returns problem details for status with the "about:blank" type, the
// standard status phrase as title, and the request's ID as instance.
func New(r *http.Request, status int, detail string) Details {
	d := Details{
		Type:   "about:blank",
		Title:  http.StatusText(status),
		Status: status,
		Detail: detail,
	}
	if id := requestid.FromContext(r.Context()); id != "" {
		d.Instance = "urn:uuid:" + id
	}
	return d
}

// Write sends d as the response. Headers already set on w (such as Allow)
// are kept.
func Write(w http.ResponseWriter, d Details) {
	w.Header().Set("Content-Type", ContentType)
	w.WriteHeader(d.Status)
	// The status line is already sent, so an encoding error cannot change the
	// response; Details holds only strings and an int, so encoding cannot fail.
	_ = json.NewEncoder(w).Encode(d)
}

// Error writes an "about:blank" problem for status. detail may be empty.
func Error(w http.ResponseWriter, r *http.Request, status int, detail string) {
	Write(w, New(r, status, detail))
}
