package problem

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/requestid"
)

// syncBuffer lets a server goroutine write logs while the test reads them.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// recovering wraps handler the way the router does: request ID, then Recoverer.
func recovering(handler http.HandlerFunc) (http.Handler, *syncBuffer) {
	buf := &syncBuffer{}
	logger := slog.New(requestid.LogHandler(slog.NewJSONHandler(buf, nil)))
	return requestid.Middleware(Recoverer(logger)(handler)), buf
}

func TestRecovererAnswersProblemDetails(t *testing.T) {
	h, logs := recovering(func(http.ResponseWriter, *http.Request) {
		var s []int
		_ = s[5] // runtime error: index out of range
	})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Equal(t, ContentType, rec.Header().Get("Content-Type"))
	var d Details
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &d))
	assert.Equal(t, "Internal Server Error", d.Title)
	assert.Empty(t, d.Detail, "no internals in the response")

	id := rec.Header().Get(requestid.Header)
	var line map[string]any
	require.NoError(t, json.Unmarshal([]byte(logs.String()), &line))
	assert.Equal(t, "ERROR", line["level"])
	assert.Equal(t, id, line[requestid.LogKey], "the panic is logged with the request ID")
	assert.Contains(t, line["panic"], "index out of range", "runtime errors are logged in full")
	assert.Contains(t, line["stack"], "recover_test.go", "the stack points at the panicking code")
	assert.Equal(t, false, line["response_started"])
}

func TestRecovererHidesPanicValues(t *testing.T) {
	for name, value := range map[string]any{
		"string": "postgres://app:s3cret@db/erp",
		"error":  errors.New("dial postgres://app:s3cret@db/erp failed"),
	} {
		t.Run(name, func(t *testing.T) {
			h, logs := recovering(func(http.ResponseWriter, *http.Request) { panic(value) })
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

			assert.Equal(t, http.StatusInternalServerError, rec.Code)
			assert.NotContains(t, logs.String(), "s3cret")
			assert.NotContains(t, rec.Body.String(), "s3cret")
			assert.Contains(t, logs.String(), "value of type")
		})
	}
}

func TestRecovererAbortsStartedResponses(t *testing.T) {
	h, logs := recovering(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"partial":`)
		w.(http.Flusher).Flush()
		panic("boom")
	})
	srv := httptest.NewServer(h)
	defer srv.Close()

	resp, err := http.Get(srv.URL)
	require.NoError(t, err, "headers were already sent")
	_, err = io.ReadAll(resp.Body)
	resp.Body.Close()

	assert.Error(t, err, "the connection is aborted instead of completing the body")
	assert.Contains(t, logs.String(), `"response_started":true`)
}

func TestRecovererPassesThroughDeliberateAborts(t *testing.T) {
	h, logs := recovering(func(http.ResponseWriter, *http.Request) { panic(http.ErrAbortHandler) })

	assert.PanicsWithValue(t, http.ErrAbortHandler, func() {
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	})
	assert.Empty(t, strings.TrimSpace(logs.String()), "deliberate aborts are not errors")
}

func TestRecovererPassesThroughNormalResponses(t *testing.T) {
	h, logs := recovering(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	assert.Equal(t, http.StatusNoContent, rec.Code)
	assert.Empty(t, logs.String())
}
