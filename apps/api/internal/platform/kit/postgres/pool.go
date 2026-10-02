// Package postgres owns the application's PostgreSQL connection pool (C18).
package postgres

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Settings are the connection settings for one database role (C43).
type Settings struct {
	Host     string
	Port     int
	Name     string // database name
	User     string
	Password string // a secret: never logged or included in errors
	SSLMode  string // disable, require, verify-ca, or verify-full
	MaxConns int32
	// Tracer, when set, observes queries and connection acquisition (for
	// example tracing, C61). Nil means none, at no cost.
	Tracer pgx.QueryTracer
}

// ErrInvalidSettings reports settings pgx cannot use. pgx's own parse error is
// deliberately not wrapped: it contains the connection string, and pgx documents
// its password redaction as best effort.
var ErrInvalidSettings = errors.New("invalid PostgreSQL connection settings")

// NewPool returns a pool for s.
//
// It does not connect. pgxpool opens connections on first use, so the API
// starts, and liveness answers, while PostgreSQL is unavailable; readiness
// (step 3b) reports whether the database can be reached. The caller must Close
// the pool, after the HTTP server has shut down.
//
// Pool settings other than MaxConns keep pgx's defaults.
func NewPool(ctx context.Context, s Settings) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(connString(s))
	if err != nil {
		return nil, ErrInvalidSettings
	}
	cfg.MaxConns = s.MaxConns
	cfg.ConnConfig.Tracer = s.Tracer

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		// Only configuration checks can fail here; the error holds no settings.
		return nil, fmt.Errorf("create PostgreSQL pool: %w", err)
	}
	return pool, nil
}

// connString builds the URL pgx parses. net/url escapes every part, so a
// password such as "p@ss/w:rd" needs no manual encoding.
func connString(s Settings) string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(s.User, s.Password),
		Host:     net.JoinHostPort(s.Host, strconv.Itoa(s.Port)),
		Path:     "/" + s.Name,
		RawQuery: url.Values{"sslmode": {s.SSLMode}}.Encode(),
	}
	return u.String()
}
