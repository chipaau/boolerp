package migrator

import (
	"context"
	"testing"
	"testing/fstest"
	"time"
)

func TestEmptyMigrationSetStillChecksDatabase(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 100*time.Millisecond)
	defer cancel()
	err := Up(ctx, "postgres://migration:private@127.0.0.1:1/erp?sslmode=disable", fstest.MapFS{})
	if err == nil || err.Error() != "migration database connection failed" {
		t.Fatalf("expected a safe connection failure, got %v", err)
	}
}
