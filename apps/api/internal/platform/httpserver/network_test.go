package httpserver

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

func startNetworkServer(t *testing.T, options Options, router http.Handler, maxBodyBytes int64) string {
	t.Helper()
	ctx, cancel := context.WithCancel(t.Context())
	output := lifecycleOutput{make(chan string, 1), make(chan struct{}, 1)}
	logger := slog.New(slog.NewJSONHandler(output, nil))
	options.Address = "127.0.0.1:0"
	options.ShutdownTimeout = time.Second
	result := make(chan error, 1)
	go func() { result <- Run(ctx, options, logger, NewHandler(router, logger, maxBodyBytes)) }()
	t.Cleanup(func() {
		cancel()
		if err := await(t, result); err != nil {
			t.Errorf("shutdown: %v", err)
		}
	})
	return await(t, output.started)
}

func dialServer(t *testing.T, address string) net.Conn {
	t.Helper()
	connection, err := net.DialTimeout("tcp", address, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { connection.Close() })
	if err := connection.SetDeadline(time.Now().Add(3 * time.Second)); err != nil {
		t.Fatal(err)
	}
	return connection
}

func TestBodyReadDeadlineAndChunkedLimit(t *testing.T) {
	router := chi.NewRouter()
	router.Post("/input", func(writer http.ResponseWriter, request *http.Request) {
		var input struct {
			Name string `json:"name"`
		}
		if DecodeJSON(writer, request, &input) {
			writer.WriteHeader(http.StatusNoContent)
		}
	})
	address := startNetworkServer(t, Options{
		ReadHeaderTimeout: 50 * time.Millisecond, ReadTimeout: 100 * time.Millisecond,
		WriteTimeout: time.Second, IdleTimeout: time.Second,
	}, router, 16)
	for _, test := range []struct {
		name, request string
		status        int
	}{
		{"slow body", "POST /input HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 16\r\n\r\n{\"name\":", http.StatusRequestTimeout},
		{"chunked body", "POST /input HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n1b\r\n{\"name\":\"0123456789012345\"}\r\n0\r\n\r\n", http.StatusRequestEntityTooLarge},
	} {
		t.Run(test.name, func(t *testing.T) {
			connection := dialServer(t, address)
			if _, err := io.WriteString(connection, test.request); err != nil {
				t.Fatal(err)
			}
			response, err := http.ReadResponse(bufio.NewReader(connection), &http.Request{Method: http.MethodPost})
			if err != nil {
				t.Fatal(err)
			}
			defer response.Body.Close()
			var body struct {
				Status    int    `json:"status"`
				RequestID string `json:"request_id"`
			}
			if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if response.StatusCode != test.status || body.Status != test.status || body.RequestID == "" || body.RequestID != response.Header.Get("X-Request-ID") {
				t.Fatalf("unexpected response: HTTP %d, %+v", response.StatusCode, body)
			}
		})
	}
}

func TestWriteDeadline(t *testing.T) {
	entered := make(chan struct{}, 1)
	router := chi.NewRouter()
	router.Get("/slow", func(writer http.ResponseWriter, request *http.Request) {
		entered <- struct{}{}
		<-time.After(500 * time.Millisecond)
		io.WriteString(writer, "late response")
	})
	address := startNetworkServer(t, Options{
		ReadHeaderTimeout: time.Second, ReadTimeout: time.Second,
		WriteTimeout: 50 * time.Millisecond, IdleTimeout: time.Second,
	}, router, 1024)
	connection := dialServer(t, address)
	if _, err := io.WriteString(connection, "GET /slow HTTP/1.1\r\nHost: localhost\r\n\r\n"); err != nil {
		t.Fatal(err)
	}
	select {
	case <-entered:
	case <-time.After(2 * time.Second):
		t.Fatal("handler was never entered")
	}
	_, err := http.ReadResponse(bufio.NewReader(connection), &http.Request{Method: http.MethodGet})
	if !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		t.Fatalf("expected the expired write deadline to close the response, got %v", err)
	}
}

func TestHeaderSizeLimit(t *testing.T) {
	router := chi.NewRouter()
	router.Get("/health", func(writer http.ResponseWriter, request *http.Request) {
		t.Error("oversized headers reached the handler")
	})
	address := startNetworkServer(t, Options{ReadHeaderTimeout: time.Second, ReadTimeout: time.Second, WriteTimeout: 2 * time.Second, IdleTimeout: time.Second}, router, 1024)
	client := &http.Client{Timeout: 2 * time.Second}
	defer client.CloseIdleConnections()
	request, err := http.NewRequest(http.MethodGet, "http://"+address+"/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("X-Oversized", strings.Repeat("x", 64<<10))
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusRequestHeaderFieldsTooLarge {
		t.Fatalf("expected 431, got %d", response.StatusCode)
	}
}

func TestHeaderAndIdleDeadlines(t *testing.T) {
	router := chi.NewRouter()
	router.Get("/health", func(writer http.ResponseWriter, request *http.Request) { writer.WriteHeader(http.StatusNoContent) })
	address := startNetworkServer(t, Options{
		ReadHeaderTimeout: 100 * time.Millisecond, ReadTimeout: time.Second,
		WriteTimeout: time.Second, IdleTimeout: 100 * time.Millisecond,
	}, router, 1024)
	for _, idle := range []bool{false, true} {
		name := "headers"
		if idle {
			name = "idle"
		}
		t.Run(name, func(t *testing.T) {
			connection := dialServer(t, address)
			request := "GET /health HTTP/1.1\r\nHost: localhost\r\n"
			if idle {
				request += "\r\n"
			}
			if _, err := io.WriteString(connection, request); err != nil {
				t.Fatal(err)
			}
			reader := bufio.NewReader(connection)
			if idle {
				response, err := http.ReadResponse(reader, &http.Request{Method: http.MethodGet})
				if err != nil {
					t.Fatal(err)
				}
				response.Body.Close()
				if response.StatusCode != http.StatusNoContent {
					t.Fatalf("health status: %d", response.StatusCode)
				}
			}
			_, err := reader.ReadByte()
			if !errors.Is(err, io.EOF) {
				t.Fatalf("expected server to close connection before the client deadline, got %v", err)
			}
		})
	}
}

func TestPanicAfterCommitAbortsConnection(t *testing.T) {
	router := chi.NewRouter()
	router.Get("/partial", func(writer http.ResponseWriter, request *http.Request) {
		io.WriteString(writer, "partial")
		if err := http.NewResponseController(writer).Flush(); err != nil {
			panic(err)
		}
		panic("private-panic-value")
	})
	address := startNetworkServer(t, Options{ReadHeaderTimeout: time.Second, ReadTimeout: time.Second, WriteTimeout: time.Second, IdleTimeout: time.Second}, router, 1024)
	client := &http.Client{Timeout: time.Second}
	defer client.CloseIdleConnections()
	response, err := client.Get("http://" + address + "/partial")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if string(body) != "partial" || !errors.Is(err, io.ErrUnexpectedEOF) {
		t.Fatalf("expected truncated response, got body=%q error=%v", body, err)
	}
}
