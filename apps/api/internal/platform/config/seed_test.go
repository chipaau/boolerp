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
		"APP_IDENTITY_KRATOS_ADMIN_URL=http://kratos:4434", "APP_IDENTITY_HYDRA_ADMIN_URL=http://hydra:4445",
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

func TestSeedReadsTheTeamPasswordFromAFile(t *testing.T) {
	cfg, err := LoadSeed(seedEnviron(t, "APP_ENV=dev", "SEED_TEAM_PASSWORD_FILE="+secretFile(t, "pw")))
	require.NoError(t, err)
	assert.Equal(t, "pw", cfg.Users.TeamPassword)
	assert.Equal(t, "s3cret", cfg.DB.Password)
}
