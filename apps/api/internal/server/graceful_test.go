package server_test

import (
	"net"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/boolmv/goerp/internal/server"
)

func TestServe_DrainsInFlightRequestButRefusesNewOnesDuringShutdown(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := ln.Addr().String()

	started := make(chan struct{})
	release := make(chan struct{})
	handlerDone := make(chan struct{})
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release // held open until the test has already sent the shutdown signal
		w.WriteHeader(http.StatusOK)
		close(handlerDone)
	})}

	stop := make(chan os.Signal, 1)
	serveErrCh := make(chan error, 1)
	go func() { serveErrCh <- server.Serve(srv, ln, stop, 2*time.Second) }()

	// Fire the in-flight request; wait for its handler to actually start before shutting down.
	reqErrCh := make(chan error, 1)
	reqStatusCh := make(chan int, 1)
	go func() {
		resp, err := http.Get("http://" + addr + "/")
		if err != nil {
			reqErrCh <- err
			return
		}
		defer resp.Body.Close()
		reqStatusCh <- resp.StatusCode
		reqErrCh <- nil
	}()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("handler never started")
	}

	// Signal shutdown while the first request is still being held open.
	stop <- os.Interrupt

	// A NEW connection attempt now, while draining, must be refused — Shutdown stops accepting
	// immediately, it only lets already-accepted requests finish.
	time.Sleep(50 * time.Millisecond) // give Shutdown a moment to close the listener
	if _, err := net.DialTimeout("tcp", addr, 500*time.Millisecond); err == nil {
		t.Fatal("want new connections refused once shutdown has begun")
	}

	// Now let the in-flight handler finish.
	close(release)

	select {
	case err := <-reqErrCh:
		if err != nil {
			t.Fatalf("in-flight request must complete successfully across shutdown, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("in-flight request never completed")
	}
	if status := <-reqStatusCh; status != http.StatusOK {
		t.Fatalf("want 200 from the in-flight request, got %d", status)
	}

	select {
	case <-handlerDone:
	case <-time.After(2 * time.Second):
		t.Fatal("handler never finished")
	}

	select {
	case err := <-serveErrCh:
		if err != nil {
			t.Fatalf("Serve should return cleanly once drained, got %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Serve never returned after the in-flight request finished")
	}
}

func TestServe_TimesOutIfDrainTakesTooLong(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := ln.Addr().String()

	started := make(chan struct{})
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		time.Sleep(2 * time.Second) // longer than the shutdown timeout below
		w.WriteHeader(http.StatusOK)
	})}

	stop := make(chan os.Signal, 1)
	serveErrCh := make(chan error, 1)
	go func() { serveErrCh <- server.Serve(srv, ln, stop, 100*time.Millisecond) }()

	go func() { _, _ = http.Get("http://" + addr + "/") }()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("handler never started")
	}

	stop <- os.Interrupt

	select {
	case err := <-serveErrCh:
		if err == nil {
			t.Fatal("want an error when the drain timeout is shorter than the in-flight handler")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Serve never returned")
	}
}
