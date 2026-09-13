// Package config loads runtime configuration from the environment (12-factor).
// Values are read once at startup into a typed Config and passed explicitly
// (no globals, no DI framework) — see cmd/api/main.go.
package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

// Config is the API's runtime configuration. Every field is env-driven with a
// sane default so the service runs out of the box; deployments override via env.
type Config struct {
	// Env is the deployment environment: dev | staging | prod.
	Env string `env:"APP_ENV" envDefault:"dev"`
	// Port is the HTTP port the API listens on.
	Port string `env:"APP_PORT" envDefault:"8080"`
	// DSN is the Postgres connection string. The app connects as the NON-OWNER
	// erp_app role (created by cmd/migrate); the default here is for local dev.
	DSN string `env:"APP_DSN" envDefault:"postgres://erp_app:erp_app@postgres:5432/erp?sslmode=disable"`
	// RedisURL is the cache + rate-limit backend.
	RedisURL string `env:"APP_REDIS_URL" envDefault:"redis://redis:6379"`
	// KratosPublicURL is the Kratos public API (session validation via whoami).
	KratosPublicURL string `env:"APP_KRATOS_PUBLIC_URL" envDefault:"http://kratos:4433"`
	// KratosAdminURL is the Kratos admin API (provisioning + revocation; internal-only).
	KratosAdminURL string `env:"APP_KRATOS_ADMIN_URL" envDefault:"http://kratos:4434"`
	// CerbosHTTPURL is the Cerbos PDP HTTP API (authorization decisions).
	CerbosHTTPURL string `env:"APP_CERBOS_HTTP_URL" envDefault:"http://cerbos:3592"`
	// ShutdownTimeout bounds graceful shutdown.
	ShutdownTimeout time.Duration `env:"APP_SHUTDOWN_TIMEOUT" envDefault:"10s"`
	// OTLPEndpoint is the OpenTelemetry collector to export traces to (host:port). Empty (the
	// self-host default) keeps tracing off — zero external calls, per component 07's design.
	OTLPEndpoint string `env:"APP_OTLP_ENDPOINT" envDefault:""`
	// MetricsEnabled turns on the opt-in /metrics Prometheus endpoint (FR-OBS-04).
	MetricsEnabled bool `env:"APP_METRICS_ENABLED" envDefault:"false"`
}

// Load reads the environment into a Config, applying defaults.
func Load() (Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return Config{}, fmt.Errorf("config: %w", err)
	}
	return c, nil
}
