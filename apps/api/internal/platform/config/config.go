package config

import (
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"time"
)

// Config contains only settings consumed by the current API runtime.
type Config struct {
	Environment     string
	Port            int
	ShutdownTimeout time.Duration
	LogFormat       string
	LogLevel        slog.Level
	HTTP            HTTP
}

type HTTP struct {
	MaxBodyBytes      int64
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
}

// Load reads process environment settings. Unset or empty values use defaults.
// Validation errors deliberately omit supplied values, which may contain secrets.
func Load(lookup func(string) (string, bool)) (Config, error) {
	value := func(key, fallback string) string {
		if raw, ok := lookup(key); ok && raw != "" {
			return raw
		}
		return fallback
	}

	cfg := Config{
		Environment: value("APP_ENV", "dev"),
		LogFormat:   value("APP_LOG_FORMAT", "json"),
	}

	switch cfg.Environment {
	case "dev", "test", "staging", "prod":
	default:
		return Config{}, errors.New("APP_ENV must be dev, test, staging, or prod")
	}

	port, err := strconv.ParseUint(value("APP_PORT", "8080"), 10, 16)
	if err != nil || port == 0 {
		return Config{}, errors.New("APP_PORT must be a decimal port from 1 to 65535")
	}
	cfg.Port = int(port)

	for _, setting := range []struct {
		key      string
		fallback string
		target   *time.Duration
	}{
		{"APP_SHUTDOWN_TIMEOUT", "10s", &cfg.ShutdownTimeout},
		{"APP_HTTP_READ_HEADER_TIMEOUT", "5s", &cfg.HTTP.ReadHeaderTimeout},
		{"APP_HTTP_READ_TIMEOUT", "15s", &cfg.HTTP.ReadTimeout},
		{"APP_HTTP_WRITE_TIMEOUT", "30s", &cfg.HTTP.WriteTimeout},
		{"APP_HTTP_IDLE_TIMEOUT", "60s", &cfg.HTTP.IdleTimeout},
	} {
		duration, err := time.ParseDuration(value(setting.key, setting.fallback))
		if err != nil || duration <= 0 {
			return Config{}, errors.New(setting.key + " must be a positive Go duration, such as 10s")
		}
		*setting.target = duration
	}
	if cfg.HTTP.ReadHeaderTimeout > cfg.HTTP.ReadTimeout {
		return Config{}, errors.New("APP_HTTP_READ_HEADER_TIMEOUT must not exceed APP_HTTP_READ_TIMEOUT")
	}
	if cfg.HTTP.WriteTimeout <= cfg.HTTP.ReadTimeout {
		return Config{}, errors.New("APP_HTTP_WRITE_TIMEOUT must exceed APP_HTTP_READ_TIMEOUT to allow an error response")
	}
	cfg.HTTP.MaxBodyBytes, err = strconv.ParseInt(value("APP_HTTP_MAX_BODY_BYTES", "1048576"), 10, 64)
	if err != nil || cfg.HTTP.MaxBodyBytes <= 0 {
		return Config{}, errors.New("APP_HTTP_MAX_BODY_BYTES must be a positive integer")
	}

	if cfg.LogFormat != "json" && cfg.LogFormat != "text" {
		return Config{}, errors.New("APP_LOG_FORMAT must be json or text")
	}

	switch strings.ToLower(value("APP_LOG_LEVEL", "info")) {
	case "debug":
		cfg.LogLevel = slog.LevelDebug
	case "info":
		cfg.LogLevel = slog.LevelInfo
	case "warn":
		cfg.LogLevel = slog.LevelWarn
	case "error":
		cfg.LogLevel = slog.LevelError
	default:
		return Config{}, errors.New("APP_LOG_LEVEL must be debug, info, warn, or error")
	}

	return cfg, nil
}
