package httpserver

import (
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// start serves handler on a free local port and returns its URL, a cancel
// function that triggers shutdown, and a channel carrying Serve's result.
func start(t *testing.T, handler http.Handler, shutdownTimeout time.Duration) (string, context.CancelFunc, <-chan error) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(t.Context())
	t.Cleanup(cancel)
	logger := slog.New(slog.DiscardHandler)

	done := make(chan error, 1)
	go func() { done <- Serve(ctx, logger, &http.Server{Handler: handler}, ln, shutdownTimeout) }()
	return "http://" + ln.Addr().String(), cancel, done
}

// wait returns Serve's result, failing the test if it does not return in time.
func wait(t *testing.T, done <-chan error) error {
	t.Helper()
	select {
	case err := <-done:
		return err
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not return")
		return nil
	}
}

func TestServeStopsCleanly(t *testing.T) {
	url, cancel, done := start(t, http.NotFoundHandler(), time.Second)

	resp, err := http.Get(url)
	require.NoError(t, err)
	resp.Body.Close()

	cancel()
	assert.NoError(t, wait(t, done))

	// The listener is closed, so new connections fail.
	_, err = http.Get(url)
	assert.Error(t, err)
}

func TestServeDrainsInFlightRequests(t *testing.T) {
	started := make(chan struct{})
	handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		time.Sleep(200 * time.Millisecond) // still running when shutdown begins
		_, _ = io.WriteString(w, "finished")
	})
	url, cancel, done := start(t, handler, 2*time.Second)

	type result struct {
		body string
		err  error
	}
	got := make(chan result, 1)
	go func() {
		resp, err := http.Get(url)
		if err != nil {
			got <- result{err: err}
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		got <- result{string(body), err}
	}()

	<-started
	cancel()

	r := <-got
	require.NoError(t, r.err)
	assert.Equal(t, "finished", r.body)
	assert.NoError(t, wait(t, done))
}

func TestServeTimeoutClosesSlowRequests(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release // outlives the shutdown timeout
	})
	url, cancel, done := start(t, handler, 100*time.Millisecond)

	reqErr := make(chan error, 1)
	go func() {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
		}
		reqErr <- err
	}()

	<-started
	cancel()

	assert.ErrorIs(t, wait(t, done), context.DeadlineExceeded)
	assert.Error(t, <-reqErr, "the slow request's connection is closed")
}

func TestServeReportsServeFailure(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	require.NoError(t, ln.Close()) // Serve on a closed listener fails at once

	err = Serve(t.Context(), slog.New(slog.DiscardHandler), &http.Server{}, ln, time.Second)
	assert.ErrorContains(t, err, "serve")
}
