package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func deployEnviron(t *testing.T, extra ...string) []string {
	t.Helper()
	return append([]string{
		"MIGRATE_DB_HOST=postgres", "MIGRATE_DB_NAME=erp", "MIGRATE_DB_USER=erp_migrate",
		"MIGRATE_DB_PASSWORD_FILE=" + secretFile(t, "s3cret"),
		"APP_IDENTITY_KRATOS_ADMIN_URL=http://kratos:4434", "APP_IDENTITY_HYDRA_ADMIN_URL=http://hydra:4445",
	}, extra...)
}

func TestDeployRunsInEveryNamedEnvironmentAsTheMigrationRole(t *testing.T) {
	_, err := LoadDeploy(deployEnviron(t))
	require.Error(t, err, "the environment must be named")
	assert.Contains(t, err.Error(), "APP_ENV")

	for _, env := range []string{"dev", "test", "staging", "prod"} {
		cfg, err := LoadDeploy(deployEnviron(t, "APP_ENV="+env, "APP_DB_USER=erp_app"))
		require.NoError(t, err, env)
		assert.Equal(t, Deploy{App: DeployApp{Environment: env}, DB: MigrateDB{
			Host: "postgres", Port: 5432, Name: "erp", User: "erp_migrate", Password: "s3cret",
			SSLMode: "verify-full",
		}, Identity: Identity{KratosAdminURL: "http://kratos:4434", HydraAdminURL: "http://hydra:4445"}},
			cfg, "the runtime role's settings are ignored")
	}
}

func TestLoadDeployErrorsNeverIncludeValues(t *testing.T) {
	_, err := LoadDeploy(deployEnviron(t, "APP_ENV=production", "MIGRATE_DB_PORT=s3cret-port"))
	require.Error(t, err)
	assert.ErrorContains(t, err, "MIGRATE_DB_PORT")
	assert.NotContains(t, err.Error(), "s3cret")
}
