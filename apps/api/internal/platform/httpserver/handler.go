package httpserver

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"net/http"
	"runtime"
	"strings"
	"time"
)

// NewHandler applies the shared HTTP boundary to a private ServeMux. It trusts
// neither inbound request IDs nor forwarded client/host/protocol headers.
func NewHandler(router *http.ServeMux, logger *slog.Logger, maxBodyBytes int64) http.Handler {
	origins := http.NewCrossOriginProtection()
	origins.SetDenyHandler(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		WriteProblem(writer, request, http.StatusForbidden, "Cross-origin requests are not allowed.")
	}))
	next := origins.Handler(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		serveRoute(router, writer, request)
	}))

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		started := time.Now()
		id := rand.Text()
		request = request.WithContext(context.WithValue(request.Context(), requestIDKey{}, id))
		for key := range request.Header {
			lower := strings.ToLower(key)
			if lower == "forwarded" || lower == "x-real-ip" || strings.HasPrefix(lower, "x-forwarded-") || lower == "x-request-id" {
				delete(request.Header, key)
			}
		}
		writer.Header().Set("X-Request-ID", id)
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		response := &responseWriter{ResponseWriter: writer, head: request.Method == http.MethodHead}
		requestLogger := logger.With("request_id", id)
		aborted := false
		defer func() {
			// Route templates are registered by the server; URLs, query strings,
			// hostnames, headers, and bodies can contain private caller data.
			requestLogger.Info("HTTP request completed", "method", logMethod(request.Method),
				"route", request.Pattern, "status", response.status, "bytes", response.bytes,
				"duration_ms", float64(time.Since(started).Microseconds())/1000, "aborted", aborted)
		}()
		defer func() {
			if recovered := recover(); recovered != nil {
				if recovered != http.ErrAbortHandler {
					// Log only function/file/line. debug.Stack() can include
					// argument values from the runtime traceback, which may
					// contain credentials or private data.
					requestLogger.Error("HTTP handler panicked", "stack", safeStack(), "response_started", response.status != 0)
				}
				if recovered == http.ErrAbortHandler || response.status != 0 {
					aborted = true
					panic(http.ErrAbortHandler)
				}
				// Discard headers staged by the failed handler, including cookies,
				// redirects, encodings, and lengths belonging to an unfinished response.
				clear(response.Header())
				response.Header().Set("X-Request-ID", id)
				response.Header().Set("X-Content-Type-Options", "nosniff")
				WriteProblem(response, request, http.StatusInternalServerError, "The server could not complete the request.")
			}
		}()

		if request.ContentLength > maxBodyBytes {
			WriteProblem(response, request, http.StatusRequestEntityTooLarge, "Request body exceeds the size limit.")
			return
		}
		request.Body = http.MaxBytesReader(writer, request.Body, maxBodyBytes)
		next.ServeHTTP(response, request)
		if response.status == 0 {
			response.WriteHeader(http.StatusOK)
		}
	})
}

// safeStack builds a stack trace containing only function names, file paths,
// and line numbers. Unlike debug.Stack(), it never includes argument values.
func safeStack() string {
	var pcs [32]uintptr
	// Skip: runtime.Callers, safeStack, defer closure, runtime.gopanic.
	n := runtime.Callers(4, pcs[:])
	frames := runtime.CallersFrames(pcs[:n])
	var b strings.Builder
	for {
		frame, more := frames.Next()
		fmt.Fprintf(&b, "%s\n\t%s:%d\n", frame.Function, frame.File, frame.Line)
		if !more {
			break
		}
	}
	return b.String()
}

type responseWriter struct {
	http.ResponseWriter
	status int
	bytes  int
	head   bool
}

func (writer *responseWriter) Unwrap() http.ResponseWriter { return writer.ResponseWriter }

func (writer *responseWriter) WriteHeader(status int) {
	if writer.status != 0 {
		return
	}
	writer.ResponseWriter.WriteHeader(status)
	// 1xx informational responses are not terminal and must not prevent the
	// final status from being recorded. 101 Switching Protocols is the
	// exception: Go treats it as committed (the connection is upgraded).
	if status >= 200 || status == http.StatusSwitchingProtocols {
		writer.status = status
	}
}

func (writer *responseWriter) Write(body []byte) (int, error) {
	if writer.status == 0 {
		writer.WriteHeader(http.StatusOK)
	}
	if writer.head {
		return len(body), nil
	}
	n, err := writer.ResponseWriter.Write(body)
	writer.bytes += n
	return n, err
}

func (writer *responseWriter) FlushError() error {
	if writer.status == 0 {
		writer.WriteHeader(http.StatusOK)
	}
	return http.NewResponseController(writer.ResponseWriter).Flush()
}

func logMethod(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut,
		http.MethodPatch, http.MethodDelete, http.MethodOptions, http.MethodConnect, http.MethodTrace:
		return method
	default:
		return "OTHER"
	}
}
