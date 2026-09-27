package config

import "testing"

func TestMigrationDSNIsSeparateAndRequired(t *testing.T) {
	if _, err := MigrationDSN(lookup(nil)); err == nil || err.Error() != "MIGRATE_DSN is required" {
		t.Fatalf("expected missing migration DSN error, got %v", err)
	}
	const secretDSN = "postgres://migration:private@db/erp"
	if got, err := MigrationDSN(lookup(map[string]string{"MIGRATE_DSN": secretDSN})); err != nil || got != secretDSN {
		t.Fatalf("migration DSN = %q, error = %v", got, err)
	}
}
