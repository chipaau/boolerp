// Package config loads runtime configuration from the environment (12-factor).
// Values are read once at startup into a typed Config and passed explicitly
// (no globals, no DI framework) — see cmd/api/main.go.
package config

import (
	"fmt"
	"strings"
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

// Dev defaults, named so validate can recognise one that has survived into a real deployment. They
// exist so `docker compose up` works with no configuration at all; the cost is that a missing
// variable in production looks exactly like a correct one.
const (
	devDSN             = "postgres://erp_app:erp_app@postgres:5432/erp?sslmode=disable"
	devRedisURL        = "redis://redis:6379"
	devKratosPublicURL = "http://kratos:4433"
	devKratosAdminURL  = "http://kratos:4434"
	devCerbosHTTPURL   = "http://cerbos:3592"
)

// Load reads the environment into a Config, applying defaults, and refuses to return one that would
// be dangerous to run.
func Load() (Config, error) {
	var c Config
	if err := env.Parse(&c); err != nil {
		return Config{}, fmt.Errorf("config: %w", err)
	}
	if err := c.validate(); err != nil {
		return Config{}, err
	}
	return c, nil
}

// validate refuses a configuration that would run, but shouldn't.
//
// Every field has a dev default so the stack starts with no configuration — which also means an
// unset variable in production is indistinguishable from a deliberate one. A deployment that forgot
// APP_DSN would come up pointing at a dev database with a dev password, successfully, and say
// nothing. Outside dev, a surviving dev default is therefore an error rather than a fallback.
//
// Every problem is reported at once: finding out about the next one only after fixing the last is a
// bad way to learn your production config is wrong.
func (c Config) validate() error {
	var problems []string

	switch c.Env {
	case "dev", "staging", "prod":
	default:
		problems = append(problems, fmt.Sprintf("APP_ENV is %q, want dev, staging or prod", c.Env))
	}
	if c.Port == "" {
		problems = append(problems, "APP_PORT is empty")
	}
	if c.ShutdownTimeout <= 0 {
		problems = append(problems, "APP_SHUTDOWN_TIMEOUT must be positive")
	}
	if c.DSN == "" {
		problems = append(problems, "APP_DSN is empty")
	}

	if c.Env != "dev" {
		for _, d := range []struct{ name, value, dev string }{
			{"APP_DSN", c.DSN, devDSN},
			{"APP_REDIS_URL", c.RedisURL, devRedisURL},
			{"APP_KRATOS_PUBLIC_URL", c.KratosPublicURL, devKratosPublicURL},
			{"APP_KRATOS_ADMIN_URL", c.KratosAdminURL, devKratosAdminURL},
			{"APP_CERBOS_HTTP_URL", c.CerbosHTTPURL, devCerbosHTTPURL},
		} {
			if d.value == d.dev {
				problems = append(problems,
					fmt.Sprintf("%s is still the dev default (%s) with APP_ENV=%s — set it explicitly", d.name, d.dev, c.Env))
			}
		}
		// Unencrypted database traffic is a dev-only convenience; outside dev it is a finding, not a
		// setting. Caught here rather than in review because it is invisible once the service is up.
		if strings.Contains(c.DSN, "sslmode=disable") {
			problems = append(problems, "APP_DSN disables TLS (sslmode=disable) outside dev")
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("config: refusing to start:\n  - %s", strings.Join(problems, "\n  - "))
	}
	return nil
}
