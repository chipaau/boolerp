// Package httpinput decodes and validates JSON request bodies (H2), writing
// failures as RFC 9457 problem details (C71–C74).
//
// Input validation covers shape and format only: required fields, lengths,
// formats, allowed values. Rules that need data, such as "email already in
// use", belong to the application layer and database constraints; they report
// through problem.ValidationError so clients see the same 422 format.
package httpinput

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
)

// validate checks request structs' `validate` tags (C27, C74). It is safe for
// concurrent use and caches struct metadata, so one instance serves all requests.
var validate = func() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())
	// Report JSON field names ("firstName"), not Go names ("FirstName").
	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "-" {
			return ""
		}
		return name
	})
	return v
}()

// Decode reads r's JSON body into dst and validates it. On failure it writes
// the problem response and returns false; the handler then just returns.
//
//   - Content-Type other than application/json: 415.
//   - Body over the limit (chi/middleware.RequestSize): 413.
//   - Empty, malformed, or more than one JSON value: 400.
//   - Wrong field types, unknown fields, or failed validation rules: 422
//     validation-error listing the failing fields (C73).
func Decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	if mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); mediaType != "application/json" {
		problem.Error(w, r, http.StatusUnsupportedMediaType, "The request body must be application/json.")
		return false
	}

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeDecodeError(w, r, err)
		return false
	}
	// Anything after the first value (another object, stray text) is rejected.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			problem.Error(w, r, http.StatusRequestEntityTooLarge, "The request body is too large.")
			return false
		}
		problem.Error(w, r, http.StatusBadRequest, "The request body must contain a single JSON value.")
		return false
	}

	if err := validate.Struct(dst); err != nil {
		var invalid validator.ValidationErrors
		if !errors.As(err, &invalid) {
			// Only programming errors reach here (for example dst is not a struct).
			problem.Error(w, r, http.StatusInternalServerError, "")
			return false
		}
		problem.WriteValidation(w, r, fieldErrors(invalid))
		return false
	}
	return true
}

// writeDecodeError maps encoding/json errors. Go reports type errors with the
// field's full path, but unknown fields and invalid dates without one (and a
// date error's message includes the submitted value), so those two point at
// the whole body ("#") with a generic detail.
func writeDecodeError(w http.ResponseWriter, r *http.Request, err error) {
	var (
		tooLarge  *http.MaxBytesError
		typeErr   *json.UnmarshalTypeError
		timeErr   *time.ParseError
		syntaxErr *json.SyntaxError
	)
	switch {
	case errors.As(err, &tooLarge):
		problem.Error(w, r, http.StatusRequestEntityTooLarge, "The request body is too large.")
	case errors.Is(err, io.EOF):
		problem.Error(w, r, http.StatusBadRequest, "The request body is empty.")
	case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
		problem.Error(w, r, http.StatusBadRequest, "The request body is not valid JSON.")
	case errors.As(err, &typeErr) && typeErr.Field != "":
		problem.WriteValidation(w, r, []problem.FieldError{{
			Pointer: pointer(strings.Split(typeErr.Field, ".")),
			Code:    "type",
			Detail:  "must be " + jsonType(typeErr.Type),
		}})
	case errors.As(err, &timeErr):
		problem.WriteValidation(w, r, []problem.FieldError{{
			Pointer: "#",
			Code:    "format",
			Detail:  "a date-time value is not in RFC 3339 format (for example 2026-01-15T09:00:00Z)",
		}})
	case strings.HasPrefix(err.Error(), "json: unknown field "):
		// encoding/json has no typed error for this; the message holds only the
		// field's name, which the client sent, never a value.
		name := strings.TrimPrefix(err.Error(), "json: unknown field ")
		problem.WriteValidation(w, r, []problem.FieldError{{
			Pointer: "#",
			Code:    "unknown",
			Detail:  "unknown field " + name,
		}})
	default:
		problem.Error(w, r, http.StatusBadRequest, "The request body could not be read.")
	}
}

// fieldErrors converts validator errors to field errors, with JSON Pointers
// built from JSON names: "Req.items[0].name" becomes "#/items/0/name".
func fieldErrors(invalid validator.ValidationErrors) []problem.FieldError {
	out := make([]problem.FieldError, 0, len(invalid))
	for _, fe := range invalid {
		_, path, _ := strings.Cut(fe.Namespace(), ".") // drop the struct's own name
		path = strings.NewReplacer("[", ".", "]", "").Replace(path)
		out = append(out, problem.FieldError{
			Pointer: pointer(strings.Split(path, ".")),
			Code:    fe.Tag(),
			Detail:  message(fe),
		})
	}
	return out
}

// pointer builds a JSON Pointer fragment (RFC 6901) from path segments.
func pointer(segments []string) string {
	escaper := strings.NewReplacer("~", "~0", "/", "~1")
	for i, s := range segments {
		segments[i] = escaper.Replace(s)
	}
	return "#/" + strings.Join(segments, "/")
}

// message describes a failed rule without the submitted value.
func message(fe validator.FieldError) string {
	p := fe.Param()
	unit := ""
	switch fe.Kind() {
	case reflect.String:
		unit = " characters"
	case reflect.Slice, reflect.Array, reflect.Map:
		unit = " items"
	}
	switch fe.Tag() {
	case "required":
		return "is required"
	case "email":
		return "must be a valid email address"
	case "url", "http_url":
		return "must be a valid URL"
	case "uuid", "uuid4", "uuid7":
		return "must be a UUID"
	case "max", "lte":
		return "must be at most " + p + unit
	case "min", "gte":
		return "must be at least " + p + unit
	case "lt":
		return "must be less than " + p + unit
	case "gt":
		return "must be greater than " + p + unit
	case "len":
		return "must be exactly " + p + unit
	case "oneof":
		return "must be one of: " + strings.Join(strings.Fields(p), ", ")
	default:
		return fmt.Sprintf("fails the %q rule", fe.Tag())
	}
}

// jsonType names the JSON type a Go type expects.
func jsonType(t reflect.Type) string {
	switch t.Kind() {
	case reflect.String:
		return "a string"
	case reflect.Bool:
		return "a boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return "an integer"
	case reflect.Float32, reflect.Float64:
		return "a number"
	case reflect.Slice, reflect.Array:
		return "an array"
	case reflect.Map, reflect.Struct:
		return "an object"
	default:
		return "a different type"
	}
}
