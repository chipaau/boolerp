package httpserver

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/observability"
)

// quick is the deadline under test; slow is long enough never to fire.
const (
	quick = 300 * time.Millisecond
	slow  = 5 * time.Second
)

// relaxed has every deadline slow. Each test shortens only the limit it checks,
// so the test fails if that one limit is removed; Go falls back to ReadTimeout
// when ReadHeaderTimeout or IdleTimeout is zero, so a shared short ReadTimeout
// would hide a missing header or idle limit.
var relaxed = Limits{ReadHeaderTimeout: slow, ReadTimeout: slow, WriteTimeout: slow, IdleTimeout: slow}

// serveLimited starts NewServer on a free port and returns its address.
func serveLimited(t *testing.T, handler http.Handler, logger *slog.Logger, l Limits) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	srv := NewServer(handler, logger, l)
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() { _ = srv.Close() })
	return ln.Addr().String()
}

// dial opens a raw TCP connection, so tests can send partial or slow requests.
func dial(t *testing.T, addr string) net.Conn {
	t.Helper()
	conn, err := net.Dial("tcp", addr)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	// A safety deadline: no test should block longer than this.
	require.NoError(t, conn.SetDeadline(time.Now().Add(2*slow)))
	return conn
}

// closedWithin reports whether the server closed conn, sending nothing, within d.
func closedWithin(t *testing.T, conn net.Conn, d time.Duration) bool {
	t.Helper()
	start := time.Now()
	n, err := conn.Read(make([]byte, 1))
	return n == 0 && errors.Is(err, io.EOF) && time.Since(start) < d
}

// syncBuffer is a bytes.Buffer safe for the server goroutine to write while the
// test goroutine reads.
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

var discard = slog.New(slog.DiscardHandler)

func ok(w http.ResponseWriter, _ *http.Request) { _, _ = io.WriteString(w, "ok") }

func TestSlowHeadersAreCutOff(t *testing.T) {
	l := relaxed
	l.ReadHeaderTimeout = quick
	conn := dial(t, serveLimited(t, http.HandlerFunc(ok), discard, l))
	_, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: x\r\n") // headers never finish

	require.NoError(t, err)
	assert.True(t, closedWithin(t, conn, slow))
}

func TestSlowBodyIsCutOff(t *testing.T) {
	l := relaxed
	l.ReadTimeout = quick
	bodyErr := make(chan error, 1)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		bodyErr <- err
	})
	conn := dial(t, serveLimited(t, handler, discard, l))
	// Declare 10 bytes but send only 2; the read deadline must stop the handler waiting.
	_, err := io.WriteString(conn, "POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 10\r\n\r\nab")
	require.NoError(t, err)

	select {
	case err := <-bodyErr:
		assert.Error(t, err)
	case <-time.After(slow):
		t.Fatal("handler was not released by the read timeout")
	}
}

func TestOversizedHeadersAreRejected(t *testing.T) {
	conn := dial(t, serveLimited(t, http.HandlerFunc(ok), discard, relaxed))
	// Exceed MaxHeaderBytes plus the 4096 bytes of slack net/http adds.
	big := strings.Repeat("a", MaxHeaderBytes+4096)
	_, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: x\r\nX-Big: "+big+"\r\n\r\n")
	require.NoError(t, err)

	resp, err := http.ReadResponse(bufio.NewReader(conn), nil)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusRequestHeaderFieldsTooLarge, resp.StatusCode)
}

func TestSlowResponsesAreCutOff(t *testing.T) {
	l := relaxed
	l.WriteTimeout = quick
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(2 * quick) // the write deadline passes first
		_, _ = io.WriteString(w, "late")
	})
	resp, err := http.Get("http://" + serveLimited(t, handler, discard, l))
	if err == nil {
		_, err = io.ReadAll(resp.Body)
		resp.Body.Close()
	}
	assert.Error(t, err, "the client must not receive the late response")
}

func TestIdleConnectionsAreClosed(t *testing.T) {
	l := relaxed
	l.IdleTimeout = quick
	conn := dial(t, serveLimited(t, http.HandlerFunc(ok), discard, l))
	_, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: x\r\n\r\n")
	require.NoError(t, err)

	reader := bufio.NewReader(conn)
	resp, err := http.ReadResponse(reader, nil)
	require.NoError(t, err)
	_, _ = io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	// Keep-alive: send nothing more. The server closes the idle connection.
	start := time.Now()
	_, err = reader.ReadByte()
	assert.ErrorIs(t, err, io.EOF)
	assert.Less(t, time.Since(start), slow, "closed by the idle timeout, not a slower limit")
}

func TestServerDiagnosticsUseTheLogger(t *testing.T) {
	var buf syncBuffer
	logger := observability.NewLogger(&buf, "json", slog.LevelInfo)
	handler := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom") // net/http reports handler panics through ErrorLog
	})
	if resp, err := http.Get("http://" + serveLimited(t, handler, logger, relaxed)); err == nil {
		resp.Body.Close()
	}

	require.Eventually(t, func() bool { return strings.Contains(buf.String(), "boom") }, 2*time.Second, 10*time.Millisecond)
	assert.Contains(t, buf.String(), `"level":"WARN"`)
}
