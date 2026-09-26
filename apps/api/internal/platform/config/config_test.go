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
			},
			want: Config{
				Environment: "prod", Port: 65535, ShutdownTimeout: 250 * time.Millisecond,
				LogFormat: "text", LogLevel: slog.LevelWarn,
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
		"APP_ENV":              {"unknown", " prod "},
		"APP_PORT":             {"0", "-1", "65536", "999999999999999999999", "http", "127.0.0.1:8080", " 8080"},
		"APP_SHUTDOWN_TIMEOUT": {"0s", "-1s", "10", "999999999999999999999h"},
		"APP_LOG_FORMAT":       {"yaml", "JSON"},
		"APP_LOG_LEVEL":        {"trace", "INFO+1"},
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
	for _, key := range []string{"APP_ENV", "APP_PORT", "APP_SHUTDOWN_TIMEOUT", "APP_LOG_FORMAT", "APP_LOG_LEVEL"} {
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
