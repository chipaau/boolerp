package requestid

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// serve runs one request through Middleware and returns the ID the handler saw
// and the response.
func serve(t *testing.T, req *http.Request) (string, *httptest.ResponseRecorder) {
	t.Helper()
	var seen string
	handler := Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		seen = FromContext(r.Context())
	}))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return seen, rec
}

func TestMiddlewareAssignsUUIDv7(t *testing.T) {
	id, rec := serve(t, httptest.NewRequest(http.MethodGet, "/", nil))

	parsed, err := uuid.Parse(id)
	require.NoError(t, err)
	assert.Equal(t, uuid.Version(7), parsed.Version())
	assert.Equal(t, id, rec.Header().Get(Header), "the response returns the same ID")
}

func TestMiddlewareIgnoresClientIDs(t *testing.T) {
	client := "0195f180-2939-7bc4-bffe-838eb3c62526" // a valid UUID traceid would otherwise accept
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(Header, client)

	id, rec := serve(t, req)

	assert.NotEqual(t, client, id)
	assert.NotEqual(t, client, rec.Header().Get(Header))
}

func TestMiddlewareAssignsDistinctIDs(t *testing.T) {
	first, _ := serve(t, httptest.NewRequest(http.MethodGet, "/", nil))
	second, _ := serve(t, httptest.NewRequest(http.MethodGet, "/", nil))

	assert.NotEqual(t, first, second)
}

func TestLogHandlerAddsRequestID(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(LogHandler(slog.NewJSONHandler(&buf, nil)))

	var id string
	Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		id = FromContext(r.Context())
		logger.InfoContext(r.Context(), "handled")
	})).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	var line map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &line))
	assert.Equal(t, id, line[LogKey])
}

func TestLogHandlerWithoutRequest(t *testing.T) {
	var buf bytes.Buffer
	slog.New(LogHandler(slog.NewJSONHandler(&buf, nil))).InfoContext(context.Background(), "startup")

	assert.NotContains(t, buf.String(), LogKey)
}
