package config_test

import (
	"strings"
	"testing"

	"github.com/boolmv/erp/internal/config"
)

// The dev defaults exist so the stack starts with no configuration at all. That convenience is also
// the hazard: a deployment that forgets APP_DSN comes up against a dev database with a dev password
// and reports nothing wrong. Outside dev, a surviving default is an error.
func TestLoad_RejectsDevDefaultsOutsideDev(t *testing.T) {
	t.Setenv("APP_ENV", "prod")
	// Everything else left unset, so every default survives.

	_, err := config.Load()
	if err == nil {
		t.Fatal("want prod to refuse the dev defaults, got a usable config")
	}
	for _, name := range []string{"APP_DSN", "APP_KRATOS_PUBLIC_URL", "APP_KRATOS_ADMIN_URL", "APP_CERBOS_HTTP_URL"} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("want %s reported as still-default, got: %v", name, err)
		}
	}
}

// Unencrypted database traffic is a dev convenience and a production finding — and invisible once
// the service is running, so it has to be caught at startup.
func TestLoad_RejectsUnencryptedDSNOutsideDev(t *testing.T) {
	t.Setenv("APP_ENV", "staging")
	t.Setenv("APP_DSN", "postgres://app:secret@db.internal:5432/erp?sslmode=disable")
	t.Setenv("APP_REDIS_URL", "redis://redis.internal:6379")
	t.Setenv("APP_KRATOS_PUBLIC_URL", "http://kratos.internal:4433")
	t.Setenv("APP_KRATOS_ADMIN_URL", "http://kratos.internal:4434")
	t.Setenv("APP_CERBOS_HTTP_URL", "http://cerbos.internal:3592")

	_, err := config.Load()
	if err == nil || !strings.Contains(err.Error(), "sslmode=disable") {
		t.Fatalf("want sslmode=disable refused outside dev, got %v", err)
	}
}

func TestLoad_AcceptsAFullyConfiguredDeployment(t *testing.T) {
	t.Setenv("APP_ENV", "prod")
	t.Setenv("APP_DSN", "postgres://app:secret@db.internal:5432/erp?sslmode=verify-full")
	t.Setenv("APP_REDIS_URL", "redis://redis.internal:6379")
	t.Setenv("APP_KRATOS_PUBLIC_URL", "http://kratos.internal:4433")
	t.Setenv("APP_KRATOS_ADMIN_URL", "http://kratos.internal:4434")
	t.Setenv("APP_CERBOS_HTTP_URL", "http://cerbos.internal:3592")

	c, err := config.Load()
	if err != nil {
		t.Fatalf("want a fully configured prod deployment accepted, got %v", err)
	}
	if c.Env != "prod" {
		t.Fatalf("Env: %q", c.Env)
	}
}

// Dev must stay zero-configuration — that is the whole point of the defaults.
func TestLoad_DevNeedsNoConfiguration(t *testing.T) {
	t.Setenv("APP_ENV", "dev")
	if _, err := config.Load(); err != nil {
		t.Fatalf("want dev to run with no configuration, got %v", err)
	}
}

func TestLoad_RejectsAnUnknownEnv(t *testing.T) {
	t.Setenv("APP_ENV", "production") // not one of dev|staging|prod
	_, err := config.Load()
	if err == nil || !strings.Contains(err.Error(), "APP_ENV") {
		t.Fatalf("want an unknown APP_ENV refused, got %v", err)
	}
}
