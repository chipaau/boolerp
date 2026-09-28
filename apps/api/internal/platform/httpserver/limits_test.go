package httpserver

import (
	"bufio"
	"bytes"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/observability"
)

// short limits keep the network tests fast.
var short = Limits{
	ReadHeaderTimeout: 200 * time.Millisecond,
	ReadTimeout:       300 * time.Millisecond,
	WriteTimeout:      400 * time.Millisecond,
	IdleTimeout:       300 * time.Millisecond,
}

// serveLimited starts NewServer on a free port and returns its address.
func serveLimited(t *testing.T, handler http.Handler, logger *slog.Logger) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	srv := NewServer(handler, logger, short)
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
	require.NoError(t, conn.SetDeadline(time.Now().Add(5*time.Second)))
	return conn
}

// closedByServer reports whether the server closed conn without sending anything.
func closedByServer(t *testing.T, conn net.Conn) bool {
	t.Helper()
	n, err := conn.Read(make([]byte, 1))
	return n == 0 && err == io.EOF
}

var discard = slog.New(slog.DiscardHandler)

func ok(w http.ResponseWriter, _ *http.Request) { _, _ = io.WriteString(w, "ok") }

func TestSlowHeadersAreCutOff(t *testing.T) {
	conn := dial(t, serveLimited(t, http.HandlerFunc(ok), discard))
	_, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: x\r\n") // headers never finish

	require.NoError(t, err)
	assert.True(t, closedByServer(t, conn))
}

func TestSlowBodyIsCutOff(t *testing.T) {
	bodyErr := make(chan error, 1)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.ReadAll(r.Body)
		bodyErr <- err
	})
	conn := dial(t, serveLimited(t, handler, discard))
	// Declare 10 bytes but send only 2; the read deadline must stop the handler waiting.
	_, err := io.WriteString(conn, "POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 10\r\n\r\nab")
	require.NoError(t, err)

	select {
	case err := <-bodyErr:
		assert.Error(t, err)
	case <-time.After(5 * time.Second):
		t.Fatal("handler was not released by the read timeout")
	}
}

func TestOversizedHeadersAreRejected(t *testing.T) {
	conn := dial(t, serveLimited(t, http.HandlerFunc(ok), discard))
	big := strings.Repeat("a", MaxHeaderBytes+4096)
	_, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: x\r\nX-Big: "+big+"\r\n\r\n")
	require.NoError(t, err)

	resp, err := http.ReadResponse(bufio.NewReader(conn), nil)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusRequestHeaderFieldsTooLarge, resp.StatusCode)
}

func TestSlowResponsesAreCutOff(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(2 * short.WriteTimeout) // the write deadline passes first
		_, _ = io.WriteString(w, "late")
	})
	resp, err := http.Get("http://" + serveLimited(t, handler, discard))
	if err == nil {
		_, err = io.ReadAll(resp.Body)
		resp.Body.Close()
	}
	assert.Error(t, err, "the client must not receive the late response")
}

func TestIdleConnectionsAreClosed(t *testing.T) {
	conn := dial(t, serveLimited(t, http.HandlerFunc(ok), discard))
	_, err := io.WriteString(conn, "GET / HTTP/1.1\r\nHost: x\r\n\r\n")
	require.NoError(t, err)

	reader := bufio.NewReader(conn)
	resp, err := http.ReadResponse(reader, nil)
	require.NoError(t, err)
	_, _ = io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	// Keep-alive: send nothing more. The server closes the idle connection.
	_, err = reader.ReadByte()
	assert.ErrorIs(t, err, io.EOF)
}

func TestServerDiagnosticsUseTheLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := observability.NewLogger(&buf, "json", slog.LevelInfo)
	handler := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom") // net/http reports handler panics through ErrorLog
	})
	_, _ = http.Get("http://" + serveLimited(t, handler, logger))

	require.Eventually(t, func() bool { return strings.Contains(buf.String(), "boom") }, 2*time.Second, 10*time.Millisecond)
	assert.Contains(t, buf.String(), `"level":"ERROR"`)
}
