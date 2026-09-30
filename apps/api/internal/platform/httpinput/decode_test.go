package httpinput

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/problem"
)

type address struct {
	Postcode string `json:"postcode" validate:"required,len=5"`
}

// request exercises nested structs, slices, dates, and common rules.
type request struct {
	FirstName string    `json:"firstName" validate:"required,max=10"`
	Email     string    `json:"email" validate:"required,email"`
	Age       int       `json:"age" validate:"gte=18"`
	Status    string    `json:"status" validate:"omitempty,oneof=active probation"`
	HiredAt   time.Time `json:"hiredAt"`
	Address   *address  `json:"address"`
	Items     []address `json:"items" validate:"dive"`
}

// decode runs Decode on body sent as contentType and returns whether it
// succeeded, the recorder, and the decoded request.
func decode(t *testing.T, contentType, body string) (bool, *httptest.ResponseRecorder, request) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	var dst request
	return Decode(rec, req, &dst), rec, dst
}

// problemOf decodes the problem response.
func problemOf(t *testing.T, rec *httptest.ResponseRecorder) problem.Details {
	t.Helper()
	assert.Equal(t, problem.ContentType, rec.Header().Get("Content-Type"))
	var d problem.Details
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &d))
	return d
}

const validBody = `{"firstName":"Aisha","email":"aisha@example.mv","age":30,"hiredAt":"2026-01-15T09:00:00Z"}`

func TestDecodeValidBody(t *testing.T) {
	for _, contentType := range []string{"application/json", "application/json; charset=utf-8"} {
		ok, rec, dst := decode(t, contentType, validBody)
		require.True(t, ok, rec.Body.String())
		assert.Equal(t, "Aisha", dst.FirstName)
		assert.Equal(t, 30, dst.Age)
	}
}

func TestDecodeUnparseableIs400(t *testing.T) {
	for name, body := range map[string]string{
		"empty":            ``,
		"malformed":        `{"firstName":`,
		"not json":         `hello`,
		"two values":       validBody + validBody,
		"trailing garbage": validBody + ` x`,
	} {
		t.Run(name, func(t *testing.T) {
			ok, rec, _ := decode(t, "application/json", body)
			assert.False(t, ok)
			assert.Equal(t, http.StatusBadRequest, rec.Code)
			d := problemOf(t, rec)
			assert.Equal(t, "about:blank", d.Type)
			assert.Empty(t, d.Errors, "nothing to point at")
		})
	}
}

func TestDecodeWrongContentTypeIs415(t *testing.T) {
	for _, contentType := range []string{"", "text/plain", "application/x-www-form-urlencoded"} {
		ok, rec, _ := decode(t, contentType, validBody)
		assert.False(t, ok)
		assert.Equal(t, http.StatusUnsupportedMediaType, rec.Code, contentType)
	}
}

func TestDecodeTooLargeIs413(t *testing.T) {
	for name, body := range map[string]string{
		"first value": `{"firstName":"` + strings.Repeat("a", 100) + `"}`,
		"trailing":    validBody + strings.Repeat(" ", 200),
	} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			// What chi/middleware.RequestSize does.
			req.Body = http.MaxBytesReader(rec, req.Body, int64(len(validBody)+10))
			var dst request
			assert.False(t, Decode(rec, req, &dst))
			assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
		})
	}
}

func TestDecodeWrongTypeIs422WithPointer(t *testing.T) {
	for body, want := range map[string]string{
		`{"age":"s3cret"}`:                            "#/age",
		`{"address":{"postcode":5}}`:                  "#/address/postcode",
		`{"items":[{"postcode":"x"},{"postcode":7}]}`: "#/items/1/postcode",
	} {
		ok, rec, _ := decode(t, "application/json", body)
		assert.False(t, ok)
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
		d := problemOf(t, rec)
		assert.Equal(t, problem.TypeValidation, d.Type)
		require.Len(t, d.Errors, 1)
		assert.Equal(t, want, d.Errors[0].Pointer)
		assert.Equal(t, "type", d.Errors[0].Code)
		assert.NotContains(t, rec.Body.String(), "s3cret")
	}
}

func TestDecodeUnknownFieldIs422(t *testing.T) {
	ok, rec, _ := decode(t, "application/json", `{"salry":"s3cret"}`)
	assert.False(t, ok)
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	d := problemOf(t, rec)
	require.Len(t, d.Errors, 1)
	assert.Equal(t, "#", d.Errors[0].Pointer, "Go does not report the field's path")
	assert.Equal(t, "unknown", d.Errors[0].Code)
	assert.Contains(t, d.Errors[0].Detail, "salry")
	assert.NotContains(t, rec.Body.String(), "s3cret")
}

func TestDecodeInvalidDateIs422WithoutTheValue(t *testing.T) {
	ok, rec, _ := decode(t, "application/json", `{"hiredAt":"s3cret-date"}`)
	assert.False(t, ok)
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	d := problemOf(t, rec)
	require.Len(t, d.Errors, 1)
	assert.Equal(t, "format", d.Errors[0].Code)
	assert.NotContains(t, rec.Body.String(), "s3cret", "Go's date error includes the value; it must not leak")
}

func TestDecodeReportsEveryRuleFailure(t *testing.T) {
	body := `{"firstName":"s3cret-too-long","email":"s3cret-not-email","age":12,"status":"fired",
		"address":{"postcode":"123"},"items":[{"postcode":"12345"},{"postcode":""}]}`
	ok, rec, _ := decode(t, "application/json", body)
	assert.False(t, ok)
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)

	d := problemOf(t, rec)
	assert.Equal(t, problem.TypeValidation, d.Type)
	assert.Equal(t, "The request has 6 invalid fields.", d.Detail)
	got := map[string]problem.FieldError{}
	for _, e := range d.Errors {
		got[e.Pointer] = e
	}
	assert.Equal(t, problem.FieldError{Pointer: "#/firstName", Code: "max", Detail: "must be at most 10 characters"}, got["#/firstName"])
	assert.Equal(t, problem.FieldError{Pointer: "#/email", Code: "email", Detail: "must be a valid email address"}, got["#/email"])
	assert.Equal(t, problem.FieldError{Pointer: "#/age", Code: "gte", Detail: "must be at least 18"}, got["#/age"])
	assert.Equal(t, problem.FieldError{Pointer: "#/status", Code: "oneof", Detail: "must be one of: active, probation"}, got["#/status"])
	assert.Equal(t, problem.FieldError{Pointer: "#/address/postcode", Code: "len", Detail: "must be exactly 5 characters"}, got["#/address/postcode"])
	assert.Equal(t, problem.FieldError{Pointer: "#/items/1/postcode", Code: "required", Detail: "is required"}, got["#/items/1/postcode"])
	assert.NotContains(t, rec.Body.String(), "s3cret", "submitted values are never echoed")
}

func TestPointerEscapesSpecialCharacters(t *testing.T) {
	assert.Equal(t, "#/a~1b/c~0d", pointer([]string{"a/b", "c~d"}))
}

// Guard: Decode must leave the body fully read so the connection can be reused.
func TestDecodeConsumesBody(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(validBody))
	req.Header.Set("Content-Type", "application/json")
	var dst request
	require.True(t, Decode(httptest.NewRecorder(), req, &dst))
	rest, _ := io.ReadAll(req.Body)
	assert.Empty(t, rest)
}
