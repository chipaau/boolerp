package respond_test

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/boolmv/erp/internal/respond"
)

func TestJSONBody_WritesTheValue(t *testing.T) {
	rec := httptest.NewRecorder()
	respond.JSONBody(rec, http.StatusCreated, map[string]string{"slug": "malecouncil"})

	if rec.Code != http.StatusCreated {
		t.Fatalf("status: want 201, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type: got %q", ct)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["slug"] != "malecouncil" {
		t.Fatalf("body: %v", body)
	}
}

// A value that can't be marshalled must produce an honest 500. Encoding straight into the
// ResponseWriter would have committed the intended status first and then truncated the body,
// leaving the client with a "successful" response it cannot parse.
func TestJSONBody_UnmarshalableValueIsA500NotATruncated200(t *testing.T) {
	for _, tc := range []struct {
		name  string
		value any
	}{
		{"channel", map[string]any{"bad": make(chan int)}},
		{"NaN", map[string]any{"bad": math.NaN()}},
		{"function", map[string]any{"bad": func() {}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			respond.JSONBody(rec, http.StatusOK, tc.value)

			if rec.Code != http.StatusInternalServerError {
				t.Fatalf("status: want 500, got %d (body %q)", rec.Code, rec.Body.String())
			}
			// Whatever we send must still be valid JSON — a truncated body is the failure being fixed.
			var body map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("the fallback body is not valid JSON (%q): %v", rec.Body.String(), err)
			}
			if body["error"] != "internal" {
				t.Fatalf("body: %v", body)
			}
		})
	}
}

func TestError_CarriesTheRequestID(t *testing.T) {
	rec := httptest.NewRecorder()
	respond.Error(context.Background(), rec, http.StatusNotFound, "not found")

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: want 404, got %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["error"] != "not found" {
		t.Fatalf("body: %v", body)
	}
	if _, ok := body["request_id"]; !ok {
		t.Fatal("want a request_id key even when the context carries none")
	}
}

func TestInvalid_Is422WithFieldErrors(t *testing.T) {
	errs := respond.FieldErrors{}
	errs.Add("slug", "is reserved by the platform")
	errs.Add("slug", "must be lowercase")
	errs.Add("code", "is required")
	if !errs.Any() {
		t.Fatal("want Any() true once errors are recorded")
	}

	rec := httptest.NewRecorder()
	respond.Invalid(context.Background(), rec, errs)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status: want 422, got %d", rec.Code)
	}
	var body struct {
		Error  string              `json:"error"`
		Errors map[string][]string `json:"errors"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Error != "validation failed" {
		t.Fatalf("error: %q", body.Error)
	}
	if len(body.Errors["slug"]) != 2 || len(body.Errors["code"]) != 1 {
		t.Fatalf("want every message per field preserved, got %v", body.Errors)
	}
}

func TestFieldErrors_EmptyIsNotAny(t *testing.T) {
	if (respond.FieldErrors{}).Any() {
		t.Fatal("an empty FieldErrors must not report failures")
	}
}
