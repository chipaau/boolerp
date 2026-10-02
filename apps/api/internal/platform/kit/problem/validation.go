package problem

import (
	"cmp"
	"fmt"
	"net/http"
	"strings"
)

// TypeValidation is the problem type for invalid request contents (C72, C73):
// the request was parsed, but one or more fields are invalid.
const TypeValidation = "https://bool.mv/problems/validation-error"

// FieldError is one entry of a validation problem's "errors" member (C71),
// following RFC 9457's example: detail plus a JSON Pointer, extended with
// parameter (for query parameters, which a JSON Pointer cannot address) and
// code (a stable rule name clients can map to their own messages).
//
// Exactly one of Pointer and Parameter is set. Detail must never contain the
// submitted value.
type FieldError struct {
	Pointer   string `json:"pointer,omitempty"`   // "#/email", "#/items/0/name", or "#" for the whole body
	Parameter string `json:"parameter,omitempty"` // "pageSize"
	Code      string `json:"code"`                // "required", "email", "max", "type", "unknown", ...
	Detail    string `json:"detail"`              // "is required"
}

// ValidationError carries field errors from any layer: request decoding, or an
// application rule such as "email already in use". The HTTP layer writes it as
// a 422 validation problem, so clients see one format whichever layer caught it.
type ValidationError struct {
	Errors []FieldError
}

func (e *ValidationError) Error() string {
	parts := make([]string, len(e.Errors))
	for i, f := range e.Errors {
		parts[i] = cmp.Or(f.Pointer, f.Parameter) + " " + f.Code
	}
	return "validation failed: " + strings.Join(parts, ", ")
}

// WriteValidation writes a 422 validation problem listing every field error.
func WriteValidation(w http.ResponseWriter, r *http.Request, errs []FieldError) {
	d := New(r, http.StatusUnprocessableEntity, "")
	d.Type = TypeValidation
	d.Detail = fmt.Sprintf("The request has %d invalid %s.", len(errs), plural(len(errs), "field", "fields"))
	d.Errors = errs
	Write(w, d)
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}
