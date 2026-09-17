package config_test

import (
	"strings"
	"testing"

	"github.com/boolmv/erp/internal/config"
)

// setEnv applies a full, valid environment, then the test's own overrides. t.Setenv restores
// everything afterwards, and fails the test if it is ever run in parallel.
func setEnv(t *testing.T, overrides map[string]string) {
	t.Helper()
	base := map[string]string{
		"APP_ENV":               "dev",
		"APP_PORT":              "8080",
		"APP_SHUTDOWN_TIMEOUT":  "10s",
		"APP_DSN":               "postgres://erp_app:erp_app@postgres:5432/erp?sslmode=disable",
		"APP_REDIS_URL":         "redis://redis:6379",
		"APP_KRATOS_PUBLIC_URL": "http://kratos:4433",
		"APP_KRATOS_ADMIN_URL":  "http://kratos:4434",
		"APP_CERBOS_HTTP_URL":   "http://cerbos:3592",
		"APP_OTLP_ENDPOINT":     "",
		"APP_METRICS_ENABLED":   "false",
	}
	for k, v := range overrides {
		base[k] = v
	}
	for k, v := range base {
		t.Setenv(k, v)
	}
}

// Nothing in the repo supplies a value any more, so an unset variable is unset — not a plausible
// default that lets a misconfigured deployment start and say nothing.
func TestLoad_RequiresEveryEnvironmentValue(t *testing.T) {
	for _, name := range []string{
		"APP_ENV", "APP_PORT", "APP_DSN", "APP_REDIS_URL",
		"APP_KRATOS_PUBLIC_URL", "APP_KRATOS_ADMIN_URL", "APP_CERBOS_HTTP_URL",
	} {
		t.Run("missing "+name, func(t *testing.T) {
			setEnv(t, map[string]string{name: ""})

			_, err := config.Load()
			if err == nil {
				t.Fatalf("want %s missing to be refused, got a usable config", name)
			}
			if !strings.Contains(err.Error(), name) {
				t.Fatalf("want the error to name %s, got: %v", name, err)
			}
		})
	}
}

// All problems at once — discovering the next one only after fixing the last is a poor way to learn
// a production configuration is wrong.
func TestLoad_ReportsEveryMissingValueTogether(t *testing.T) {
	setEnv(t, map[string]string{"APP_DSN": "", "APP_REDIS_URL": "", "APP_CERBOS_HTTP_URL": ""})

	_, err := config.Load()
	if err == nil {
		t.Fatal("want an error")
	}
	for _, name := range []string{"APP_DSN", "APP_REDIS_URL", "APP_CERBOS_HTTP_URL"} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("want %s reported alongside the others, got: %v", name, err)
		}
	}
}

// Unencrypted database traffic is a dev convenience and a production finding, invisible once the
// service is running — so it is caught at startup.
func TestLoad_RejectsUnencryptedDSNOutsideDev(t *testing.T) {
	setEnv(t, map[string]string{
		"APP_ENV": "staging",
		"APP_DSN": "postgres://app:secret@db.internal:5432/erp?sslmode=disable",
	})

	_, err := config.Load()
	if err == nil || !strings.Contains(err.Error(), "sslmode=disable") {
		t.Fatalf("want sslmode=disable refused outside dev, got %v", err)
	}
}

func TestLoad_AcceptsAFullyConfiguredDeployment(t *testing.T) {
	setEnv(t, map[string]string{
		"APP_ENV":               "prod",
		"APP_DSN":               "postgres://app:secret@db.internal:5432/erp?sslmode=verify-full",
		"APP_KRATOS_PUBLIC_URL": "http://kratos.internal:4433",
		"APP_KRATOS_ADMIN_URL":  "http://kratos.internal:4434",
		"APP_CERBOS_HTTP_URL":   "http://cerbos.internal:3592",
	})

	c, err := config.Load()
	if err != nil {
		t.Fatalf("want a fully configured prod deployment accepted, got %v", err)
	}
	if c.Env != "prod" || c.ShutdownTimeout <= 0 {
		t.Fatalf("config: %+v", c)
	}
}

// The dev values in .env.example must actually satisfy validation, or `cp .env.example .env` doesn't
// give a working setup — which is the whole contract of that file.
func TestLoad_AcceptsTheDevEnvironment(t *testing.T) {
	setEnv(t, nil)
	if _, err := config.Load(); err != nil {
		t.Fatalf("want the documented dev environment accepted, got %v", err)
	}
}

func TestLoad_RejectsAnUnknownEnv(t *testing.T) {
	setEnv(t, map[string]string{"APP_ENV": "production"}) // not one of dev|staging|prod
	_, err := config.Load()
	if err == nil || !strings.Contains(err.Error(), "APP_ENV") {
		t.Fatalf("want an unknown APP_ENV refused, got %v", err)
	}
}
