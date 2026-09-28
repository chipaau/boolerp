package config

import (
	"log/slog"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// defaults is the configuration expected when no variables are set.
func defaults() Config {
	return Config{
		Environment:           "dev",
		Port:                  8080,
		LogFormat:             "json",
		LogLevel:              slog.LevelInfo,
		ShutdownTimeout:       10 * time.Second,
		HTTPMaxBodyBytes:      1 << 20,
		HTTPReadHeaderTimeout: 5 * time.Second,
		HTTPReadTimeout:       15 * time.Second,
		HTTPWriteTimeout:      30 * time.Second,
		HTTPIdleTimeout:       60 * time.Second,
	}
}

func TestLoadDefaults(t *testing.T) {
	for name, environ := range map[string][]string{
		"unset": nil,
		"empty": {
			"APP_ENV=", "APP_PORT=", "APP_LOG_FORMAT=", "APP_LOG_LEVEL=", "APP_SHUTDOWN_TIMEOUT=",
			"APP_HTTP_MAX_BODY_BYTES=", "APP_HTTP_READ_HEADER_TIMEOUT=", "APP_HTTP_READ_TIMEOUT=",
			"APP_HTTP_WRITE_TIMEOUT=", "APP_HTTP_IDLE_TIMEOUT=",
		},
	} {
		t.Run(name, func(t *testing.T) {
			cfg, err := Load(environ)
			require.NoError(t, err)
			assert.Equal(t, defaults(), cfg)
		})
	}
}

func TestLoadValues(t *testing.T) {
	cfg, err := Load([]string{
		"APP_ENV=prod", "APP_PORT=9000", "APP_LOG_FORMAT=text", "APP_LOG_LEVEL=DEBUG",
		"APP_SHUTDOWN_TIMEOUT=500ms", "APP_HTTP_MAX_BODY_BYTES=2048",
		"APP_HTTP_READ_HEADER_TIMEOUT=2s", "APP_HTTP_READ_TIMEOUT=2s",
		"APP_HTTP_WRITE_TIMEOUT=3s", "APP_HTTP_IDLE_TIMEOUT=4s",
	})
	require.NoError(t, err)
	assert.Equal(t, Config{
		Environment:           "prod",
		Port:                  9000,
		LogFormat:             "text",
		LogLevel:              slog.LevelDebug,
		ShutdownTimeout:       500 * time.Millisecond,
		HTTPMaxBodyBytes:      2048,
		HTTPReadHeaderTimeout: 2 * time.Second,
		HTTPReadTimeout:       2 * time.Second,
		HTTPWriteTimeout:      3 * time.Second,
		HTTPIdleTimeout:       4 * time.Second,
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
		{"shutdown timeout too long", []string{"APP_SHUTDOWN_TIMEOUT=6m"}, "APP_SHUTDOWN_TIMEOUT", "6m"},
		{"body limit not a number", []string{"APP_HTTP_MAX_BODY_BYTES=s3cret"}, "APP_HTTP_MAX_BODY_BYTES", "s3cret"},
		{"body limit zero", []string{"APP_HTTP_MAX_BODY_BYTES=0"}, "APP_HTTP_MAX_BODY_BYTES", ""},
		{"body limit too large", []string{"APP_HTTP_MAX_BODY_BYTES=104857601"}, "APP_HTTP_MAX_BODY_BYTES", "104857601"},
		{"idle timeout not a duration", []string{"APP_HTTP_IDLE_TIMEOUT=s3cret"}, "APP_HTTP_IDLE_TIMEOUT", "s3cret"},
		{"read timeout zero", []string{"APP_HTTP_READ_TIMEOUT=0s"}, "APP_HTTP_READ_TIMEOUT", ""},
		{
			"header timeout above read timeout",
			[]string{"APP_HTTP_READ_HEADER_TIMEOUT=20s", "APP_HTTP_READ_TIMEOUT=15s"},
			"APP_HTTP_READ_HEADER_TIMEOUT", "20s",
		},
		{
			"write timeout not above read timeout",
			[]string{"APP_HTTP_READ_TIMEOUT=30s", "APP_HTTP_WRITE_TIMEOUT=30s"},
			"APP_HTTP_WRITE_TIMEOUT", "HTTPReadTimeout", // names the other variable, not the Go field
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Load(tt.environ)
			require.Error(t, err)
			assert.ErrorContains(t, err, tt.variable)
			if tt.value != "" {
				assert.NotContains(t, err.Error(), tt.value, "error discloses the value")
			}
		})
	}
}
