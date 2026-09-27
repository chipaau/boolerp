package postgres

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/boolmv/erp/internal/platform/config"
)

func TestOpenLeavesDatabaseAvailabilityToReadiness(t *testing.T) {
	pool, err := Open(context.Background(), config.Database{
		DSN:      "postgres://app:private-password@127.0.0.1:1/erp?sslmode=disable",
		MaxConns: 2, PingTimeout: 100 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("pool construction tried to connect: %v", err)
	}
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	started := time.Now()
	if err := pool.Ping(ctx); err == nil || err.Error() != "PostgreSQL ping failed" {
		t.Fatalf("expected safe ping failure, got %v", err)
	}
	if time.Since(started) > time.Second {
		t.Fatal("readiness ping exceeded its deadline")
	}
}

func TestInvalidDSNErrorDoesNotEchoCredentials(t *testing.T) {
	_, err := Open(context.Background(), config.Database{
		DSN: "postgres://user:private-password@%zz/database", MaxConns: 1, PingTimeout: time.Second,
	})
	if err == nil || strings.Contains(err.Error(), "private-password") {
		t.Fatalf("expected a safe invalid DSN error, got %v", err)
	}
}
