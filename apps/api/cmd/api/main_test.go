package main

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthz(t *testing.T) {
	rec := httptest.NewRecorder()
	newRouter(1024).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/healthz", nil))

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, ".", rec.Body.String())
}

func TestRequestBodyLimit(t *testing.T) {
	// Add a test-only route to the real router, behind the real middleware.
	var readErr error
	router := newRouter(8)
	router.Post("/api/echo", func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
	})

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/echo", strings.NewReader("12345678")))
	require.NoError(t, readErr, "a body at the limit is accepted")

	router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/echo", strings.NewReader("123456789")))
	var tooLarge *http.MaxBytesError
	assert.True(t, errors.As(readErr, &tooLarge), "a body over the limit fails with MaxBytesError")
}
