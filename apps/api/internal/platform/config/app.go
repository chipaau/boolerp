package config

import "time"

// App holds settings for the process as a whole (APP_*), like Laravel's
// config/app.php.
type App struct {
	// Environment is an operational log label, not an access-control or
	// deployment-mode switch.
	Environment string `env:"ENV" envDefault:"dev" validate:"oneof=dev test staging prod"`
	// ListenPort is the TCP port the API serves on.
	ListenPort int `env:"PORT" envDefault:"8080" validate:"min=1,max=65535"`
	// ShutdownTimeout bounds graceful shutdown: how long in-flight requests may
	// take to finish after SIGINT/SIGTERM before connections are closed. It must
	// be at least the HTTP write timeout, so any request the server allows can
	// finish (C30); that rule spans groups, so it is checked in config.go.
	ShutdownTimeout time.Duration `env:"SHUTDOWN_TIMEOUT" envDefault:"35s" validate:"gt=0,max=10m"`
}
