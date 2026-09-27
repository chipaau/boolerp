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
	Database        Database
}

type HTTP struct {
	MaxBodyBytes      int64
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
}

type Database struct {
	DSN         string
	MaxConns    int32
	PingTimeout time.Duration
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
		Database: Database{
			DSN: value("APP_DSN", "postgres://erp_app:erp_app@postgres:5432/erp?sslmode=disable"),
		},
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
		ceiling  time.Duration
		target   *time.Duration
	}{
		{"APP_SHUTDOWN_TIMEOUT", "10s", 5 * time.Minute, &cfg.ShutdownTimeout},
		{"APP_HTTP_READ_HEADER_TIMEOUT", "5s", time.Minute, &cfg.HTTP.ReadHeaderTimeout},
		{"APP_HTTP_READ_TIMEOUT", "15s", 5 * time.Minute, &cfg.HTTP.ReadTimeout},
		{"APP_HTTP_WRITE_TIMEOUT", "30s", 10 * time.Minute, &cfg.HTTP.WriteTimeout},
		{"APP_HTTP_IDLE_TIMEOUT", "60s", 10 * time.Minute, &cfg.HTTP.IdleTimeout},
	} {
		duration, err := time.ParseDuration(value(setting.key, setting.fallback))
		if err != nil || duration < time.Millisecond || duration > setting.ceiling {
			return Config{}, errors.New(setting.key + " must be between 1ms and " + setting.ceiling.String())
		}
		*setting.target = duration
	}
	if cfg.HTTP.ReadHeaderTimeout > cfg.HTTP.ReadTimeout {
		return Config{}, errors.New("APP_HTTP_READ_HEADER_TIMEOUT must not exceed APP_HTTP_READ_TIMEOUT")
	}
	if cfg.HTTP.WriteTimeout <= cfg.HTTP.ReadTimeout {
		return Config{}, errors.New("APP_HTTP_WRITE_TIMEOUT must exceed APP_HTTP_READ_TIMEOUT to allow an error response")
	}
	const maxBodyCeiling = 100 << 20 // 100 MiB
	cfg.HTTP.MaxBodyBytes, err = strconv.ParseInt(value("APP_HTTP_MAX_BODY_BYTES", "1048576"), 10, 64)
	if err != nil || cfg.HTTP.MaxBodyBytes <= 0 || cfg.HTTP.MaxBodyBytes > maxBodyCeiling {
		return Config{}, errors.New("APP_HTTP_MAX_BODY_BYTES must be between 1 and 104857600")
	}
	maxConns, err := strconv.ParseInt(value("APP_DB_MAX_CONNS", "20"), 10, 32)
	if err != nil || maxConns < 1 || maxConns > 1000 {
		return Config{}, errors.New("APP_DB_MAX_CONNS must be between 1 and 1000")
	}
	cfg.Database.MaxConns = int32(maxConns)
	cfg.Database.PingTimeout, err = time.ParseDuration(value("APP_DB_PING_TIMEOUT", "2s"))
	if err != nil || cfg.Database.PingTimeout < time.Millisecond || cfg.Database.PingTimeout > time.Minute {
		return Config{}, errors.New("APP_DB_PING_TIMEOUT must be between 1ms and 1m")
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

// MigrationDSN loads only the credential used by the explicit migration command.
// It is deliberately separate from the API process configuration.
func MigrationDSN(lookup func(string) (string, bool)) (string, error) {
	dsn, ok := lookup("MIGRATE_DSN")
	if !ok || dsn == "" {
		return "", errors.New("MIGRATE_DSN is required")
	}
	return dsn, nil
}
