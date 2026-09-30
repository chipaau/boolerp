package config

import "time"

// DB holds the PostgreSQL connection for the restricted runtime role (APP_DB_*,
// C43). Host, name, user, and password are required with no defaults: a default
// would put credentials in code. The password is a secret, never logged or
// echoed in errors, and is read only from a file (C80).
type DB struct {
	Host string `env:"HOST,required,notEmpty" validate:"hostname_rfc1123|ip"`
	Port int    `env:"PORT" envDefault:"5432" validate:"min=1,max=65535"`
	Name string `env:"NAME,required,notEmpty"`
	User string `env:"USER,required,notEmpty"`
	// Password is the contents of the file APP_DB_PASSWORD_FILE names, used as
	// is: a trailing newline would be part of the password.
	Password string `env:"PASSWORD_FILE,file,required,notEmpty" validate:"required"`
	// SSLMode defaults to verify-full: encrypted, with the server certificate and
	// host name checked. pgx's "allow" and "prefer" are excluded because they fall
	// back to an unencrypted connection without saying so.
	SSLMode string `env:"SSLMODE" envDefault:"verify-full" validate:"oneof=disable require verify-ca verify-full"`
	// MaxConns caps the connection pool.
	MaxConns int32 `env:"MAX_CONNS" envDefault:"20" validate:"min=1,max=1000"`
	// PingTimeout bounds the readiness check's database ping (C45).
	PingTimeout time.Duration `env:"PING_TIMEOUT" envDefault:"2s" validate:"gt=0,max=1m"`
}
