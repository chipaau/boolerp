package config

import (
	"log/slog"
	"strings"
	"testing"
	"time"
)

func lookup(values map[string]string) func(string) (string, bool) {
	return func(key string) (string, bool) {
		value, ok := values[key]
		return value, ok
	}
}

func TestLoadDefaultsAndOverrides(t *testing.T) {
	defaults := Config{
		Environment:     "dev",
		Port:            8080,
		ShutdownTimeout: 10 * time.Second,
		LogFormat:       "json",
		LogLevel:        slog.LevelInfo,
		HTTP: HTTP{
			MaxBodyBytes: 1048576, ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second,
		},
	}
	tests := []struct {
		name   string
		values map[string]string
		want   Config
	}{
		{name: "unset", want: defaults},
		{
			name: "empty",
			values: map[string]string{
				"APP_ENV": "", "APP_PORT": "", "APP_SHUTDOWN_TIMEOUT": "",
				"APP_LOG_FORMAT": "", "APP_LOG_LEVEL": "",
			},
			want: defaults,
		},
		{
			name: "overrides",
			values: map[string]string{
				"APP_ENV": "prod", "APP_PORT": "65535", "APP_SHUTDOWN_TIMEOUT": "250ms",
				"APP_LOG_FORMAT": "text", "APP_LOG_LEVEL": "WARN",
				"APP_HTTP_MAX_BODY_BYTES": "2048", "APP_HTTP_READ_HEADER_TIMEOUT": "1s",
				"APP_HTTP_READ_TIMEOUT": "2s", "APP_HTTP_WRITE_TIMEOUT": "3s", "APP_HTTP_IDLE_TIMEOUT": "4s",
			},
			want: Config{
				Environment: "prod", Port: 65535, ShutdownTimeout: 250 * time.Millisecond,
				LogFormat: "text", LogLevel: slog.LevelWarn,
				HTTP: HTTP{
					MaxBodyBytes: 2048, ReadHeaderTimeout: time.Second,
					ReadTimeout: 2 * time.Second, WriteTimeout: 3 * time.Second, IdleTimeout: 4 * time.Second,
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Load(lookup(tt.values))
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Fatalf("got %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestLoadRejectsInvalidSettings(t *testing.T) {
	tests := map[string][]string{
		"APP_ENV":                      {"unknown", " prod "},
		"APP_PORT":                     {"0", "-1", "65536", "999999999999999999999", "http", "127.0.0.1:8080", " 8080"},
		"APP_SHUTDOWN_TIMEOUT":         {"0s", "-1s", "10", "999ns", "6m"},
		"APP_LOG_FORMAT":               {"yaml", "JSON"},
		"APP_LOG_LEVEL":                {"trace", "INFO+1"},
		"APP_HTTP_MAX_BODY_BYTES":      {"0", "-1", "many", "999999999999999999999", "104857601"},
		"APP_HTTP_READ_HEADER_TIMEOUT": {"0s", "-1s", "10", "20s", "999ns", "2m"},
		"APP_HTTP_READ_TIMEOUT":        {"0s", "-1s", "10", "1s", "30s", "999ns", "6m"},
		"APP_HTTP_WRITE_TIMEOUT":       {"0s", "-1s", "10", "15s", "999ns", "11m"},
		"APP_HTTP_IDLE_TIMEOUT":        {"0s", "-1s", "10", "999ns", "11m"},
	}
	for key, values := range tests {
		for _, value := range values {
			t.Run(key+"/"+value, func(t *testing.T) {
				_, err := Load(lookup(map[string]string{key: value}))
				if err == nil || !strings.Contains(err.Error(), key) {
					t.Fatalf("expected an error naming %s, got %v", key, err)
				}
			})
		}
	}
}

func TestValidationErrorsDoNotEchoValues(t *testing.T) {
	const secret = "private-token\nforged log entry"
	for _, key := range []string{
		"APP_ENV", "APP_PORT", "APP_SHUTDOWN_TIMEOUT", "APP_LOG_FORMAT", "APP_LOG_LEVEL",
		"APP_HTTP_MAX_BODY_BYTES", "APP_HTTP_READ_HEADER_TIMEOUT", "APP_HTTP_READ_TIMEOUT",
		"APP_HTTP_WRITE_TIMEOUT", "APP_HTTP_IDLE_TIMEOUT",
	} {
		t.Run(key, func(t *testing.T) {
			_, err := Load(lookup(map[string]string{key: secret}))
			if err == nil || !strings.Contains(err.Error(), key) {
				t.Fatalf("expected an error naming %s", key)
			}
			if strings.Contains(err.Error(), "private-token") || strings.Contains(err.Error(), "forged log entry") {
				t.Fatal("validation error contains the supplied value")
			}
		})
	}
}
