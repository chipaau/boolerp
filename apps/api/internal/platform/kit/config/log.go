package config

import "log/slog"

// Log holds logging settings (APP_LOG_*).
type Log struct {
	Format string `env:"FORMAT" envDefault:"json" validate:"oneof=json text"`
	// slog.Level parses itself (it implements encoding.TextUnmarshaler), and
	// caarlos0/env uses that: "debug", "INFO", "warn", "error", or offsets like "info+2".
	Level slog.Level `env:"LEVEL" envDefault:"info"`
}
