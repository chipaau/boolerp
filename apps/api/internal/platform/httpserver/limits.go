package httpserver

import (
	"log/slog"
	"net/http"
	"time"
)

// MaxHeaderBytes caps the request line plus headers. net/http adds 4096 bytes of
// slack, so the effective limit is about 36 KiB; beyond it Go answers
// 431 Request Header Fields Too Large.
const MaxHeaderBytes = 32 << 10 // 32 KiB

// Limits are the network deadlines applied by http.Server. They bound slow or
// idle clients; they do not stop work already running inside a handler.
type Limits struct {
	ReadHeaderTimeout time.Duration // request line and headers
	ReadTimeout       time.Duration // the whole request, including the body
	WriteTimeout      time.Duration // from the end of the header read to the end of the response
	IdleTimeout       time.Duration // between keep-alive requests
}

// NewServer returns an http.Server with the limits applied. The server's own
// diagnostics (for example "http: TLS handshake error" or a handler panic)
// are written to logger at error level instead of the standard log package.
func NewServer(handler http.Handler, logger *slog.Logger, l Limits) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: l.ReadHeaderTimeout,
		ReadTimeout:       l.ReadTimeout,
		WriteTimeout:      l.WriteTimeout,
		IdleTimeout:       l.IdleTimeout,
		MaxHeaderBytes:    MaxHeaderBytes,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
}
