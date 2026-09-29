// Package redis owns the application's Redis client, used as a cache (C04).
//
// Redis is optional at runtime (C52): the API stays ready without it, and cache
// callers fall back to PostgreSQL. So the client is configured to fail fast
// rather than wait and retry.
package redis

import (
	"context"
	"crypto/tls"
	"fmt"
	"log/slog"
	"net"
	"strconv"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// Settings are the cache connection settings (C53).
type Settings struct {
	Host     string
	Port     int
	Username string
	Password string // a secret: never logged
	DB       int
	TLS      bool          // encrypt, verifying the server certificate against Host
	Timeout  time.Duration // bound on connecting, reading, and writing
}

// NewClient returns a client for s. Like the PostgreSQL pool, it does not
// connect until first use, so the API starts while Redis is unavailable. The
// caller must Close it, after the HTTP server has shut down.
//
// go-redis's defaults (5s timeouts, 5 dial retries, 3 command retries) could
// hold a request for many seconds during an outage. Here each call makes one
// attempt bounded by s.Timeout and by the caller's context, then fails, so the
// caller can fall back to PostgreSQL.
func NewClient(s Settings) *goredis.Client {
	opts := &goredis.Options{
		Addr:     net.JoinHostPort(s.Host, strconv.Itoa(s.Port)),
		Username: s.Username,
		Password: s.Password,
		DB:       s.DB,

		DialTimeout:           s.Timeout,
		ReadTimeout:           s.Timeout,
		WriteTimeout:          s.Timeout,
		ContextTimeoutEnabled: true, // a cancelled or expired request stops waiting
		MaxRetries:            -1,   // -1 disables command retries
		DialerRetries:         1,    // one connection attempt per call
	}
	if s.TLS {
		opts.TLSConfig = &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}
	}
	return goredis.NewClient(opts)
}

// RouteLogs sends go-redis's own diagnostics (for example "failed to dial")
// to logger at warn level, instead of plain text on stderr, like net/http's
// ErrorLog (C31). go-redis's logger is process-wide, so main calls this once.
func RouteLogs(logger *slog.Logger) {
	goredis.SetLogger(logAdapter{logger.With("component", "go-redis")})
}

// logAdapter implements go-redis's Printf-style logging interface on slog.
type logAdapter struct{ logger *slog.Logger }

func (a logAdapter) Printf(ctx context.Context, format string, v ...any) {
	a.logger.WarnContext(ctx, fmt.Sprintf(format, v...))
}
