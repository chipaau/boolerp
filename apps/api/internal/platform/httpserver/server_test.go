package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"testing"
	"time"
)

// Observe lifecycle events to discover the OS-assigned port and synchronize
// shutdown tests without fixed ports or sleeps.
type lifecycleOutput struct {
	started  chan string
	stopping chan struct{}
}

func (output lifecycleOutput) Write(data []byte) (int, error) {
	var event struct {
		Message string `json:"msg"`
		Address string `json:"address"`
	}
	if err := json.Unmarshal(data, &event); err != nil {
		return 0, err
	}
	switch event.Message {
	case "HTTP server started":
		output.started <- event.Address
	case "HTTP server stopping":
		output.stopping <- struct{}{}
	}
	return len(data), nil
}

func await[T any](t *testing.T, channel <-chan T) T {
	t.Helper()
	select {
	case value := <-channel:
		return value
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for server or request")
		var zero T
		return zero
	}
}

func TestShutdownWithActiveRequest(t *testing.T) {
	for _, finishRequest := range []bool{true, false} {
		name := "deadline closes connection"
		timeout := 50 * time.Millisecond
		if finishRequest {
			name = "request drains"
			timeout = 3 * time.Second
		}
		t.Run(name, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			entered := make(chan struct{}, 1)
			release := make(chan struct{})
			finish := sync.OnceFunc(func() { close(release) })
			t.Cleanup(finish)
			handler := http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
				entered <- struct{}{}
				select {
				case <-release:
					io.WriteString(writer, "finished")
				case <-request.Context().Done():
				}
			})
			output := lifecycleOutput{make(chan string, 1), make(chan struct{}, 1)}
			logger := slog.New(slog.NewJSONHandler(output, nil))
			result := make(chan error, 1)
			stopped := make(chan struct{})
			go func() {
				result <- Run(ctx, Options{Address: "127.0.0.1:0", ShutdownTimeout: timeout}, logger, handler)
				close(stopped)
			}()
			t.Cleanup(func() {
				cancel()
				finish()
				await(t, stopped)
			})
			address := await(t, output.started)

			client := &http.Client{Timeout: 4 * time.Second}
			defer client.CloseIdleConnections()
			type responseResult struct {
				body string
				err  error
			}
			response := make(chan responseResult, 1)
			go func() {
				res, err := client.Get("http://" + address)
				if err != nil {
					response <- responseResult{err: err}
					return
				}
				defer res.Body.Close()
				body, err := io.ReadAll(res.Body)
				response <- responseResult{body: string(body), err: err}
			}()
			await(t, entered)
			cancel()
			await(t, output.stopping)
			if finishRequest {
				select {
				case err := <-result:
					t.Fatalf("server returned before the active request finished: %v", err)
				default:
				}
				finish()
				if err := await(t, result); err != nil {
					t.Fatal(err)
				}
				got := await(t, response)
				if got.err != nil || got.body != "finished" {
					t.Fatalf("active request did not finish: %+v", got)
				}
			} else {
				if err := await(t, result); !errors.Is(err, context.DeadlineExceeded) {
					t.Fatalf("expected shutdown deadline error, got %v", err)
				}
				if got := await(t, response); got.err == nil {
					t.Fatal("request connection remained usable after the shutdown deadline")
				}
			}
		})
	}
}
