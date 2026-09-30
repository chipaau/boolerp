package config

import "time"

// Redis holds the cache connection (APP_REDIS_*, C53). Redis is a cache: the API
// stays ready without it and falls back to PostgreSQL (C52).
type Redis struct {
	Host string `env:"HOST,required,notEmpty" validate:"hostname_rfc1123|ip"`
	Port int    `env:"PORT" envDefault:"6379" validate:"min=1,max=65535"`
	// Username and Password are optional because a local Redis has neither;
	// production should require authentication. Password is a secret, given
	// directly or as a file path (APP_REDIS_PASSWORD_FILE, C80), never both.
	Username string `env:"USERNAME"`
	Password string `env:"PASSWORD" validate:"excluded_with=PasswordFile"`
	// PasswordFile holds the contents of the file APP_REDIS_PASSWORD_FILE names;
	// load moves it into Password.
	PasswordFile string `env:"PASSWORD_FILE,file"`
	DB           int    `env:"DB" envDefault:"0" validate:"min=0,max=15"`
	// TLS defaults to on, with the server certificate verified; Compose turns it off.
	TLS bool `env:"TLS" envDefault:"true"`
	// Timeout bounds connecting, reading, and writing, so an unavailable cache
	// fails fast and the request falls back to PostgreSQL.
	Timeout time.Duration `env:"TIMEOUT" envDefault:"500ms" validate:"gt=0,max=10s"`
}
