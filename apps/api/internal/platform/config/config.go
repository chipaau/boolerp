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

	cfg.ShutdownTimeout, err = time.ParseDuration(value("APP_SHUTDOWN_TIMEOUT", "10s"))
	if err != nil || cfg.ShutdownTimeout <= 0 {
		return Config{}, errors.New("APP_SHUTDOWN_TIMEOUT must be a positive Go duration, such as 10s")
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
