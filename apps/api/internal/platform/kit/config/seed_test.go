package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedEnviron(t *testing.T, extra ...string) []string {
	t.Helper()
	return append([]string{
		"APP_DB_HOST=postgres", "APP_DB_NAME=erp", "APP_DB_USER=erp_app",
		"APP_DB_PASSWORD_FILE=" + secretFile(t, "s3cret"),
		"MIGRATE_DB_HOST=postgres", "MIGRATE_DB_NAME=erp", "MIGRATE_DB_USER=erp_migrate",
		"MIGRATE_DB_PASSWORD_FILE=" + secretFile(t, "m1grate"),
		"APP_IDENTITY_KRATOS_ADMIN_URL=http://kratos:4434", "APP_IDENTITY_HYDRA_ADMIN_URL=http://hydra:4445",
		"APP_PLATFORM_DOMAIN=bool.test",
	}, extra...)
}

func TestSeedNeedsAnExplicitNonProductionEnvironment(t *testing.T) {
	_, err := LoadSeed(seedEnviron(t))
	require.Error(t, err, "the API's dev default does not apply")
	assert.Contains(t, err.Error(), "APP_ENV")

	_, err = LoadSeed(seedEnviron(t, "APP_ENV=prod"))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "APP_ENV")

	for _, env := range []string{"dev", "test", "staging"} {
		cfg, err := LoadSeed(seedEnviron(t, "APP_ENV="+env))
		require.NoError(t, err, env)
		assert.Equal(t, env, cfg.App.Environment)
	}
}

func TestSeedConnectsAsBothRoles(t *testing.T) {
	cfg, err := LoadSeed(seedEnviron(t, "APP_ENV=dev"))
	require.NoError(t, err)
	assert.Equal(t, "erp_app", cfg.DB.User, "demo data as the runtime role")
	assert.Equal(t, MigrateDB{Host: "postgres", Port: 5432, Name: "erp", User: "erp_migrate",
		Password: "m1grate", SSLMode: "verify-full"}, cfg.Migrate, "seed files as the owner")
}

func TestPlatformDomainIsABareLowercaseDomain(t *testing.T) {
	cfg, err := LoadSeed(seedEnviron(t, "APP_ENV=dev"))
	require.NoError(t, err)
	assert.Equal(t, "bool.test", cfg.Platform.Domain)

	for _, bad := range []string{"", "Bool.mv", "https://bool.mv", "bool.mv:443", "bool.mv/", "localhost"} {
		_, err := LoadSeed(seedEnviron(t, "APP_ENV=dev", "APP_PLATFORM_DOMAIN="+bad))
		require.Error(t, err, bad)
		assert.Contains(t, err.Error(), "APP_PLATFORM_DOMAIN", bad)
	}
}
