package config

import (
	"log/slog"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// requiredDB are the settings without defaults; withDB adds them to a test
// environment, first, so later entries in environ override them.
var requiredDB = []string{
	"APP_DB_HOST=postgres", "APP_DB_NAME=erp", "APP_DB_USER=erp_app", "APP_DB_PASSWORD=s3cret",
}

func withDB(environ []string) []string {
	return append(append([]string{}, requiredDB...), environ...)
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
			SSLMode: "verify-full", MaxConns: 20,
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
			"APP_DB_PORT=", "APP_DB_SSLMODE=", "APP_DB_MAX_CONNS=",
		},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := Load(withDB(environ))
			require.NoError(t, err)
			assert.Equal(t, defaults(), cfg)
		})
	}
}

func TestLoadValues(t *testing.T) {
	cfg, err := Load(withDB([]string{
		"APP_ENV=prod", "APP_PORT=9000", "APP_SHUTDOWN_TIMEOUT=3s",
		"APP_LOG_FORMAT=text", "APP_LOG_LEVEL=DEBUG",
		"APP_HTTP_MAX_BODY_BYTES=2048", "APP_HTTP_READ_HEADER_TIMEOUT=2s", "APP_HTTP_READ_TIMEOUT=2s",
		"APP_HTTP_WRITE_TIMEOUT=3s", "APP_HTTP_IDLE_TIMEOUT=4s",
		"APP_HTTP_TRUSTED_PROXY_HOPS=2", "APP_HTTP_ALLOWED_ORIGINS=https://app.bool.mv,http://localhost:3000",
		"APP_DB_HOST=10.0.0.5", "APP_DB_PORT=6543", "APP_DB_SSLMODE=disable", "APP_DB_MAX_CONNS=5",
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
			SSLMode: "disable", MaxConns: 5,
		},
	}, cfg)
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
		{"DB password empty", []string{"APP_DB_PASSWORD="}, "APP_DB_PASSWORD", ""},
		{"DB port too large", []string{"APP_DB_PORT=70000"}, "APP_DB_PORT", "70000"},
		{"DB port not a number", []string{"APP_DB_PORT=s3cret"}, "APP_DB_PORT: invalid int", "s3cret"},
		{"SSL mode prefer", []string{"APP_DB_SSLMODE=prefer"}, "APP_DB_SSLMODE", "prefer"},
		{"SSL mode unknown", []string{"APP_DB_SSLMODE=s3cret"}, "APP_DB_SSLMODE", "s3cret"},
		{"max conns zero", []string{"APP_DB_MAX_CONNS=0"}, "APP_DB_MAX_CONNS", ""},
		{"max conns too many", []string{"APP_DB_MAX_CONNS=1001"}, "APP_DB_MAX_CONNS", "1001"},
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
			_, err := Load(withDB(tt.environ))
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
	for _, name := range []string{"APP_DB_HOST", "APP_DB_NAME", "APP_DB_USER", "APP_DB_PASSWORD"} {
		assert.ErrorContains(t, err, name)
	}
}

func TestLoadNeverEchoesPassword(t *testing.T) {
	// An invalid setting elsewhere must not pull the password into the error.
	_, err := Load(withDB([]string{"APP_PORT=0"}))
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "s3cret")
}

func TestCrossFieldErrorsNameVariables(t *testing.T) {
	_, err := Load(withDB([]string{"APP_SHUTDOWN_TIMEOUT=10s", "APP_HTTP_READ_TIMEOUT=30s", "APP_HTTP_WRITE_TIMEOUT=30s"}))
	require.Error(t, err)
	assert.ErrorContains(t, err, "APP_SHUTDOWN_TIMEOUT: must satisfy gtefield=APP_HTTP_WRITE_TIMEOUT")
	assert.ErrorContains(t, err, "APP_HTTP_WRITE_TIMEOUT: must satisfy gtfield=APP_HTTP_READ_TIMEOUT")
}

func TestSliceErrorsNameVariableAndIndex(t *testing.T) {
	_, err := Load(withDB([]string{"APP_HTTP_ALLOWED_ORIGINS=https://app.bool.mv,*"}))
	assert.ErrorContains(t, err, "APP_HTTP_ALLOWED_ORIGINS[1]: must satisfy origin")
}

// TestFieldNamesAreUnique protects parse-error redaction: caarlos0/env reports
// only a field's name, so two groups must never share one.
func TestFieldNamesAreUnique(t *testing.T) {
	seen := map[string]string{}
	top := reflect.TypeFor[Config]()
	for i := range top.NumField() {
		group := top.Field(i)
		for j := range group.Type.NumField() {
			name := group.Type.Field(j).Name
			if other, ok := seen[name]; ok {
				t.Errorf("field %s is in both %s and %s", name, other, group.Name)
			}
			seen[name] = group.Name
		}
	}
}

func TestEveryFieldHasAVariable(t *testing.T) {
	for path, variable := range variablesByPath {
		assert.Regexp(t, `^APP_[A-Z_]+$`, variable, path)
	}
	assert.Len(t, variablesByPath, 19, "update this count when adding a setting")
}
