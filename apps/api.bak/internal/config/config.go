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

// Config is the API's runtime configuration, read entirely from the environment.
//
// There are deliberately NO defaults for environment-specific values. A default here is a config
// value living in code: it ships inside the production binary, duplicates whatever the environment
// files already say, and — worst — turns a variable someone forgot to set into a plausible-looking
// success. Local values live in .env (see .env.example), which is the only place they live.
type Config struct {
	// Env is the deployment environment: dev | staging | prod.
	Env string `env:"APP_ENV"`
	// Port is the HTTP port the API listens on.
	Port string `env:"APP_PORT"`
	// DSN is the Postgres connection string. The app connects as the NON-OWNER
	// erp_app role (created by cmd/migrate); the default here is for local dev.
	DSN string `env:"APP_DSN"`
	// RedisURL is the cache + rate-limit backend.
	RedisURL string `env:"APP_REDIS_URL"`
	// KratosPublicURL is the Kratos public API (session validation via whoami).
	KratosPublicURL string `env:"APP_KRATOS_PUBLIC_URL"`
	// KratosAdminURL is the Kratos admin API (provisioning + revocation; internal-only).
	KratosAdminURL string `env:"APP_KRATOS_ADMIN_URL"`
	// CerbosHTTPURL is the Cerbos PDP HTTP API (authorization decisions).
	CerbosHTTPURL string `env:"APP_CERBOS_HTTP_URL"`
	// ShutdownTimeout bounds graceful shutdown.
	ShutdownTimeout time.Duration `env:"APP_SHUTDOWN_TIMEOUT"`
	// OTLPEndpoint is the OpenTelemetry collector to export traces to (host:port). Empty (the
	// self-host default) keeps tracing off — zero external calls, per component 07's design.
	OTLPEndpoint string `env:"APP_OTLP_ENDPOINT"`
	// MetricsEnabled turns on the opt-in /metrics Prometheus endpoint (FR-OBS-04).
	MetricsEnabled bool `env:"APP_METRICS_ENABLED"`
}

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
// With no defaults in code, "unset" is simply unset — so this checks that required values are
// present rather than trying to recognise a dev value that leaked into production. Every problem is
// reported at once: learning about the next one only after fixing the last is a poor way to discover
// your production configuration is wrong.
func (c Config) validate() error {
	var problems []string

	switch c.Env {
	case "dev", "staging", "prod":
	case "":
		problems = append(problems, "APP_ENV is not set (dev, staging or prod)")
	default:
		problems = append(problems, fmt.Sprintf("APP_ENV is %q, want dev, staging or prod", c.Env))
	}

	for _, r := range []struct{ name, value string }{
		{"APP_PORT", c.Port},
		{"APP_DSN", c.DSN},
		{"APP_REDIS_URL", c.RedisURL},
		{"APP_KRATOS_PUBLIC_URL", c.KratosPublicURL},
		{"APP_KRATOS_ADMIN_URL", c.KratosAdminURL},
		{"APP_CERBOS_HTTP_URL", c.CerbosHTTPURL},
	} {
		if strings.TrimSpace(r.value) == "" {
			problems = append(problems, r.name+" is not set")
		}
	}
	if c.ShutdownTimeout <= 0 {
		problems = append(problems, "APP_SHUTDOWN_TIMEOUT is not set, or not positive")
	}

	// Unencrypted database traffic is a dev-only convenience; outside dev it is a finding, not a
	// setting, and it is invisible once the service is up.
	if c.Env != "dev" && strings.Contains(c.DSN, "sslmode=disable") {
		problems = append(problems, "APP_DSN disables TLS (sslmode=disable) outside dev")
	}

	if len(problems) > 0 {
		return fmt.Errorf("config: refusing to start:\n  - %s\n(local setup: cp .env.example .env)",
			strings.Join(problems, "\n  - "))
	}
	return nil
}
