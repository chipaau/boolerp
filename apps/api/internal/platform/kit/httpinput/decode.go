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
	"regexp"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/go-playground/validator/v10/non-standard/validators"

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
	// The shared formats every module's requests use (C208), registered here only: a new
	// one is added here with its message, never in a module. notblank is the validator's
	// own, from its non-standard set.
	for tag, fn := range map[string]validator.Func{
		"phone": matches(phonePattern), "slug": matches(slugPattern), "notblank": validators.NotBlank,
	} {
		if err := v.RegisterValidation(tag, fn); err != nil {
			panic(err) // the tags are fixed above, so this cannot fail
		}
	}
	return v
}()

var (
	// phonePattern is a phone number in international form: + and 6 to 15 digits.
	phonePattern = regexp.MustCompile(`^\+[0-9]{6,15}$`)
	// slugPattern is a lowercase DNS label of 3 to 63 characters, as a host's first
	// label needs; it may start with a digit.
	slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)
)

func matches(re *regexp.Regexp) validator.Func {
	return func(fl validator.FieldLevel) bool { return re.MatchString(fl.Field().String()) }
}

// RegisterStructValidation adds a module's rules for one of its request types that span
// several fields or are its own knowledge without needing data, such as reserved slugs or
// exactly one primary item (C208). fn reports each failure with ReportError, naming the
// field by its JSON path ("slug", "institutionTypes[1].code") and a code as the tag;
// Decode then answers them as field errors with the other rules'. Call it once, from the
// module's package initialisation.
func RegisterStructValidation(fn validator.StructLevelFunc, types ...any) {
	validate.RegisterStructValidation(fn, types...)
}

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
			Pointer: problem.Pointer(strings.Split(typeErr.Field, ".")...),
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
			Pointer: problem.Pointer(strings.Split(path, ".")...),
			Code:    fe.Tag(),
			Detail:  message(fe),
		})
	}
	return out
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
	case "notblank":
		return "must not be blank"
	case "phone":
		return "must be in international form: + and 6 to 15 digits"
	case "slug":
		return "must be 3 to 63 lowercase letters, digits, and hyphens, not starting or ending with a hyphen"
	case "timezone":
		return "must be an IANA time zone, such as Indian/Maldives"
	case "datetime":
		return "must be a date in the form " + p
	case "uppercase":
		return "must be in capital letters"
	case "alphanum":
		return "must be letters and digits only"
	case "reserved":
		return "is a name the platform uses"
	case "unique":
		return "is listed twice"
	case "primary":
		return "must mark exactly one item as primary"
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
