package config

import (
	"log/slog"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// withDB adds the settings without defaults to a test environment, first, so
// later entries in environ override them. The password file contains "s3cret".
func withDB(t *testing.T, environ []string) []string {
	t.Helper()
	required := []string{
		"APP_DB_HOST=postgres", "APP_DB_NAME=erp", "APP_DB_USER=erp_app",
		"APP_DB_PASSWORD_FILE=" + secretFile(t, "s3cret"), "APP_REDIS_HOST=redis",
		"APP_AUTH_ISSUER=http://identity.bool.test/",
		"APP_IDENTITY_KRATOS_ADMIN_URL=http://kratos:4434",
		"APP_IDENTITY_HYDRA_ADMIN_URL=http://hydra:4445",
	}
	return append(required, environ...)
}

// secretFile writes content to a file in a test directory and returns its path.
func secretFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "secret")
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
	return path
}

// defaults is the configuration expected when only the required settings are set.
func defaults() Config {
	return Config{
		App: App{Environment: "dev", ListenPort: 8080, ShutdownTimeout: 35 * time.Second},
		Log: Log{Format: "json", Level: slog.LevelInfo},
		HTTP: HTTP{
			MaxBodyBytes:      1 << 20,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       15 * time.Second,
			WriteTimeout:      30 * time.Second,
			IdleTimeout:       60 * time.Second,
		},
		DB: DB{
			Host: "postgres", Port: 5432, Name: "erp", User: "erp_app", Password: "s3cret",
			SSLMode: "verify-full", MaxConns: 20, PingTimeout: 2 * time.Second,
		},
		Redis: Redis{Host: "redis", Port: 6379, TLS: true, Timeout: 500 * time.Millisecond},
		Auth:  Auth{Issuer: "http://identity.bool.test/", Audience: "erp-api"},
		Identity: Identity{
			KratosAdminURL: "http://kratos:4434", HydraAdminURL: "http://hydra:4445",
		},
	}
}

func TestLoadDefaults(t *testing.T) {
	for name, environ := range map[string][]string{
		"unset": nil,
		"empty": {
			"APP_ENV=", "APP_PORT=", "APP_LOG_FORMAT=", "APP_LOG_LEVEL=", "APP_SHUTDOWN_TIMEOUT=",
			"APP_HTTP_MAX_BODY_BYTES=", "APP_HTTP_READ_HEADER_TIMEOUT=", "APP_HTTP_READ_TIMEOUT=",
			"APP_HTTP_WRITE_TIMEOUT=", "APP_HTTP_IDLE_TIMEOUT=",
			"APP_HTTP_TRUSTED_PROXY_HOPS=", "APP_HTTP_ALLOWED_ORIGINS=",
			"APP_DB_PORT=", "APP_DB_SSLMODE=", "APP_DB_MAX_CONNS=", "APP_DB_PING_TIMEOUT=",
			"APP_REDIS_PORT=", "APP_REDIS_DB=", "APP_REDIS_TLS=", "APP_REDIS_TIMEOUT=",
		},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := Load(withDB(t, environ))
			require.NoError(t, err)
			assert.Equal(t, defaults(), cfg)
		})
	}
}

func TestLoadValues(t *testing.T) {
	cfg, err := Load(withDB(t, []string{
		"APP_ENV=prod", "APP_PORT=9000", "APP_SHUTDOWN_TIMEOUT=3s",
		"APP_LOG_FORMAT=text", "APP_LOG_LEVEL=DEBUG",
		"APP_HTTP_MAX_BODY_BYTES=2048", "APP_HTTP_READ_HEADER_TIMEOUT=2s", "APP_HTTP_READ_TIMEOUT=2s",
		"APP_HTTP_WRITE_TIMEOUT=3s", "APP_HTTP_IDLE_TIMEOUT=4s",
		"APP_HTTP_TRUSTED_PROXY_HOPS=2", "APP_HTTP_ALLOWED_ORIGINS=https://app.bool.mv,http://localhost:3000",
		"APP_DB_HOST=10.0.0.5", "APP_DB_PORT=6543", "APP_DB_SSLMODE=disable", "APP_DB_MAX_CONNS=5",
		"APP_DB_PING_TIMEOUT=500ms",
		"APP_REDIS_HOST=10.0.0.6", "APP_REDIS_PORT=6380", "APP_REDIS_USERNAME=cache",
		"APP_REDIS_PASSWORD_FILE=" + secretFile(t, "s3cret-redis"), "APP_REDIS_DB=2", "APP_REDIS_TLS=false", "APP_REDIS_TIMEOUT=250ms",
	}))
	require.NoError(t, err)
	assert.Equal(t, Config{
		App: App{Environment: "prod", ListenPort: 9000, ShutdownTimeout: 3 * time.Second},
		Log: Log{Format: "text", Level: slog.LevelDebug},
		HTTP: HTTP{
			MaxBodyBytes:      2048,
			ReadHeaderTimeout: 2 * time.Second,
			ReadTimeout:       2 * time.Second,
			WriteTimeout:      3 * time.Second,
			IdleTimeout:       4 * time.Second,
			TrustedProxyHops:  2,
			AllowedOrigins:    []string{"https://app.bool.mv", "http://localhost:3000"},
		},
		DB: DB{
			Host: "10.0.0.5", Port: 6543, Name: "erp", User: "erp_app", Password: "s3cret",
			SSLMode: "disable", MaxConns: 5, PingTimeout: 500 * time.Millisecond,
		},
		Redis: Redis{
			Host: "10.0.0.6", Port: 6380, Username: "cache", Password: "s3cret-redis", DB: 2,
			TLS: false, Timeout: 250 * time.Millisecond,
		},
		Auth: Auth{Issuer: "http://identity.bool.test/", Audience: "erp-api"},
		Identity: Identity{
			KratosAdminURL: "http://kratos:4434", HydraAdminURL: "http://hydra:4445",
		},
	}, cfg)
}

func TestLoadIdentity(t *testing.T) {
	// Kratos's admin API must be an HTTP URL.
	_, err := Load(withDB(t, []string{"APP_IDENTITY_KRATOS_ADMIN_URL=kratos:4434"}))
	assert.ErrorContains(t, err, "APP_IDENTITY_KRATOS_ADMIN_URL")
}

func TestLoadAuth(t *testing.T) {
	cfg, err := Load(withDB(t, []string{"APP_AUTH_AUDIENCE=other-api"}))
	require.NoError(t, err)
	assert.Equal(t, Auth{Issuer: "http://identity.bool.test/", Audience: "other-api"}, cfg.Auth)

	_, err = Load([]string{
		"APP_DB_HOST=postgres", "APP_DB_NAME=erp", "APP_DB_USER=erp_app",
		"APP_DB_PASSWORD_FILE=" + secretFile(t, "s3cret"), "APP_REDIS_HOST=redis",
	})
	assert.ErrorContains(t, err, "APP_AUTH_ISSUER")
	_, err = Load(withDB(t, []string{"APP_AUTH_ISSUER=not a url"}))
	assert.ErrorContains(t, err, "APP_AUTH_ISSUER")
}

func TestLoadInvalid(t *testing.T) {
	tests := []struct {
		name     string
		environ  []string
		variable string // must appear in the error
		value    string // must not appear in the error
	}{
		{"port not a number", []string{"APP_PORT=s3cret"}, "APP_PORT", "s3cret"},
		{"port zero", []string{"APP_PORT=0"}, "APP_PORT", ""},
		{"port too large", []string{"APP_PORT=70000"}, "APP_PORT", "70000"},
		{"unknown environment", []string{"APP_ENV=s3cret"}, "APP_ENV", "s3cret"},
		{"unknown log format", []string{"APP_LOG_FORMAT=s3cret"}, "APP_LOG_FORMAT", "s3cret"},
		{"unknown log level", []string{"APP_LOG_LEVEL=s3cret"}, "APP_LOG_LEVEL", "s3cret"},
		{"shutdown timeout not a duration", []string{"APP_SHUTDOWN_TIMEOUT=s3cret"}, "APP_SHUTDOWN_TIMEOUT", "s3cret"},
		{"shutdown timeout zero", []string{"APP_SHUTDOWN_TIMEOUT=0s"}, "APP_SHUTDOWN_TIMEOUT", ""},
		{"shutdown timeout negative", []string{"APP_SHUTDOWN_TIMEOUT=-1s"}, "APP_SHUTDOWN_TIMEOUT", ""},
		{"shutdown timeout too long", []string{"APP_SHUTDOWN_TIMEOUT=11m"}, "APP_SHUTDOWN_TIMEOUT", "11m"},
		{
			"shutdown timeout below write timeout",
			[]string{"APP_SHUTDOWN_TIMEOUT=10s", "APP_HTTP_WRITE_TIMEOUT=30s"},
			"APP_SHUTDOWN_TIMEOUT", "WriteTimeout", // names APP_HTTP_WRITE_TIMEOUT instead
		},
		{"body limit not a number", []string{"APP_HTTP_MAX_BODY_BYTES=s3cret"}, "APP_HTTP_MAX_BODY_BYTES", "s3cret"},
		{"body limit zero", []string{"APP_HTTP_MAX_BODY_BYTES=0"}, "APP_HTTP_MAX_BODY_BYTES", ""},
		{"body limit too large", []string{"APP_HTTP_MAX_BODY_BYTES=104857601"}, "APP_HTTP_MAX_BODY_BYTES", "104857601"},
		{"idle timeout not a duration", []string{"APP_HTTP_IDLE_TIMEOUT=s3cret"}, "APP_HTTP_IDLE_TIMEOUT", "s3cret"},
		{"read timeout zero", []string{"APP_HTTP_READ_TIMEOUT=0s"}, "APP_HTTP_READ_TIMEOUT", ""},
		// withDB adds the required settings first, so later entries override them.
		{"DB host empty", []string{"APP_DB_HOST="}, "APP_DB_HOST", ""},
		{"DB host invalid", []string{"APP_DB_HOST=db/s3cret"}, "APP_DB_HOST", "s3cret"},
		{"DB password file unset", []string{"APP_DB_PASSWORD_FILE="}, "APP_DB_PASSWORD_FILE", ""},
		{"DB port too large", []string{"APP_DB_PORT=70000"}, "APP_DB_PORT", "70000"},
		{"DB port not a number", []string{"APP_DB_PORT=s3cret"}, "APP_DB_PORT: invalid int", "s3cret"},
		{"SSL mode prefer", []string{"APP_DB_SSLMODE=prefer"}, "APP_DB_SSLMODE", "prefer"},
		{"SSL mode unknown", []string{"APP_DB_SSLMODE=s3cret"}, "APP_DB_SSLMODE", "s3cret"},
		{"max conns zero", []string{"APP_DB_MAX_CONNS=0"}, "APP_DB_MAX_CONNS", ""},
		{"max conns too many", []string{"APP_DB_MAX_CONNS=1001"}, "APP_DB_MAX_CONNS", "1001"},
		{"redis host empty", []string{"APP_REDIS_HOST="}, "APP_REDIS_HOST", ""},
		{"redis port not a number", []string{"APP_REDIS_PORT=s3cret"}, "APP_REDIS_PORT: invalid int", "s3cret"},
		{"redis DB too large", []string{"APP_REDIS_DB=16"}, "APP_REDIS_DB", ""},
		{"redis TLS not a bool", []string{"APP_REDIS_TLS=s3cret"}, "APP_REDIS_TLS: invalid bool", "s3cret"},
		{"redis timeout zero", []string{"APP_REDIS_TIMEOUT=0s"}, "APP_REDIS_TIMEOUT", ""},
		{"ping timeout zero", []string{"APP_DB_PING_TIMEOUT=0s"}, "APP_DB_PING_TIMEOUT", ""},
		{"ping timeout too long", []string{"APP_DB_PING_TIMEOUT=2m"}, "APP_DB_PING_TIMEOUT", "2m"},
		{"max conns not a number", []string{"APP_DB_MAX_CONNS=s3cret"}, "APP_DB_MAX_CONNS", "s3cret"},
		{"proxy hops not a number", []string{"APP_HTTP_TRUSTED_PROXY_HOPS=s3cret"}, "APP_HTTP_TRUSTED_PROXY_HOPS", "s3cret"},
		{"proxy hops negative", []string{"APP_HTTP_TRUSTED_PROXY_HOPS=-1"}, "APP_HTTP_TRUSTED_PROXY_HOPS", ""},
		{"proxy hops too many", []string{"APP_HTTP_TRUSTED_PROXY_HOPS=11"}, "APP_HTTP_TRUSTED_PROXY_HOPS", ""},
		{"origin wildcard", []string{"APP_HTTP_ALLOWED_ORIGINS=*"}, "APP_HTTP_ALLOWED_ORIGINS", ""},
		{"origin with wildcard host", []string{"APP_HTTP_ALLOWED_ORIGINS=https://*.bool.mv"}, "APP_HTTP_ALLOWED_ORIGINS", ""},
		{"origin with path", []string{"APP_HTTP_ALLOWED_ORIGINS=https://app.bool.mv/s3cret"}, "APP_HTTP_ALLOWED_ORIGINS", "s3cret"},
		{"origin without scheme", []string{"APP_HTTP_ALLOWED_ORIGINS=app.bool.mv"}, "APP_HTTP_ALLOWED_ORIGINS", ""},
		{
			"header timeout above read timeout",
			[]string{"APP_HTTP_READ_HEADER_TIMEOUT=20s", "APP_HTTP_READ_TIMEOUT=15s"},
			"APP_HTTP_READ_HEADER_TIMEOUT", "20s",
		},
		{
			"write timeout not above read timeout",
			[]string{"APP_HTTP_READ_TIMEOUT=30s", "APP_HTTP_WRITE_TIMEOUT=30s"},
			"APP_HTTP_WRITE_TIMEOUT", "=ReadTimeout", // names the other variable, not the Go field
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Load(withDB(t, tt.environ))
			require.Error(t, err)
			assert.ErrorContains(t, err, tt.variable)
			if tt.value != "" {
				assert.NotContains(t, err.Error(), tt.value, "error discloses the value")
			}
		})
	}
}

func TestLoadRequiresDBSettings(t *testing.T) {
	_, err := Load(nil)
	require.Error(t, err)
	for _, name := range []string{"APP_DB_HOST", "APP_DB_NAME", "APP_DB_USER", "APP_DB_PASSWORD_FILE"} {
		assert.ErrorContains(t, err, name)
	}
}

func TestLoadPasswordFileErrors(t *testing.T) {
	for name, tt := range map[string]struct {
		file string
		want string
	}{
		"missing file": {"/run/secrets/missing", `could not load content of file "/run/secrets/missing" from variable APP_DB_PASSWORD_FILE`},
		"empty file":   {secretFile(t, ""), "APP_DB_PASSWORD_FILE: must satisfy required"},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := Load(withDB(t, []string{"APP_DB_PASSWORD_FILE=" + tt.file}))
			require.Error(t, err)
			assert.ErrorContains(t, err, tt.want)
		})
	}
}

func TestLoadNeverEchoesPassword(t *testing.T) {
	// An invalid setting elsewhere must not pull the password into the error.
	_, err := Load(withDB(t, []string{"APP_PORT=0"}))
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret")
}

func TestCrossFieldErrorsNameVariables(t *testing.T) {
	_, err := Load(withDB(t, []string{"APP_SHUTDOWN_TIMEOUT=10s", "APP_HTTP_READ_TIMEOUT=30s", "APP_HTTP_WRITE_TIMEOUT=30s"}))
	require.Error(t, err)
	assert.ErrorContains(t, err, "APP_SHUTDOWN_TIMEOUT: must satisfy gtefield=APP_HTTP_WRITE_TIMEOUT")
	assert.ErrorContains(t, err, "APP_HTTP_WRITE_TIMEOUT: must satisfy gtfield=APP_HTTP_READ_TIMEOUT")
}

func TestSliceErrorsNameVariableAndIndex(t *testing.T) {
	_, err := Load(withDB(t, []string{"APP_HTTP_ALLOWED_ORIGINS=https://app.bool.mv,*"}))
	assert.ErrorContains(t, err, "APP_HTTP_ALLOWED_ORIGINS[1]: must satisfy origin")
}

// TestSameFieldNameInTwoGroups: groups are parsed separately, so a parse error
// in DB.Port and one in Redis.Port are each named by their own variable.
func TestSameFieldNameInTwoGroups(t *testing.T) {
	_, err := Load(withDB(t, []string{"APP_DB_PORT=x", "APP_REDIS_PORT=y"}))
	require.Error(t, err)
	assert.ErrorContains(t, err, "APP_DB_PORT: invalid int")
	assert.ErrorContains(t, err, "APP_REDIS_PORT: invalid int")
}

func TestEveryFieldHasAVariable(t *testing.T) {
	api := variables(reflect.TypeFor[Config]())
	for path, variable := range api.byPath {
		assert.Regexp(t, `^APP_[A-Z_]+$`, variable, path)
	}
	assert.Len(t, api.byPath, 31, "update this count when adding a setting")

	migrate := variables(reflect.TypeFor[Migrate]())
	for path, variable := range migrate.byPath {
		assert.Regexp(t, `^MIGRATE_[A-Z_]+$`, variable, path, "cmd/migrate reads only MIGRATE_*")
	}
}

func TestLoadMigrate(t *testing.T) {
	cfg, err := LoadMigrate([]string{
		"MIGRATE_DB_HOST=postgres", "MIGRATE_DB_NAME=erp", "MIGRATE_DB_USER=erp_migrate",
		"MIGRATE_DB_PASSWORD_FILE=" + secretFile(t, "s3cret"),
		// The API's settings are ignored.
		"APP_DB_HOST=elsewhere", "APP_DB_USER=erp_app",
	})
	require.NoError(t, err)
	assert.Equal(t, Migrate{DB: MigrateDB{
		Host: "postgres", Port: 5432, Name: "erp", User: "erp_migrate", Password: "s3cret",
		SSLMode: "verify-full",
	}}, cfg)
}

func TestLoadMigrateErrors(t *testing.T) {
	_, err := LoadMigrate(nil)
	require.Error(t, err)
	for _, name := range []string{"MIGRATE_DB_HOST", "MIGRATE_DB_NAME", "MIGRATE_DB_USER", "MIGRATE_DB_PASSWORD_FILE"} {
		assert.ErrorContains(t, err, name)
	}

	_, err = LoadMigrate([]string{
		"MIGRATE_DB_HOST=postgres", "MIGRATE_DB_NAME=erp", "MIGRATE_DB_USER=erp_migrate",
		"MIGRATE_DB_PASSWORD_FILE=" + secretFile(t, "s3cret"), "MIGRATE_DB_PORT=s3cret-port", "MIGRATE_DB_SSLMODE=prefer",
	})
	require.Error(t, err)
	assert.ErrorContains(t, err, "MIGRATE_DB_PORT: invalid int")
	assert.NotContains(t, err.Error(), "s3cret")
}
