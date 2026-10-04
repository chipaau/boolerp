package config

import "time"

// Cerbos holds the connection to the authorization policy engine (APP_CERBOS_*,
// C152, C155).
type Cerbos struct {
	// Addr is Cerbos's gRPC listener, host:port, on the internal network (cerbos:3593).
	Addr string `env:"ADDR,required,notEmpty" validate:"hostname_port"`
	// TLSCAFile is the CA certificate Cerbos's TLS certificate is checked against.
	// Empty means plaintext, which is allowed only when APP_ENV is dev or test.
	TLSCAFile string `env:"TLS_CA_FILE"`
	// Timeout bounds every check; a slower Cerbos means the request is refused.
	Timeout time.Duration `env:"TIMEOUT" envDefault:"2s" validate:"min=100ms,max=30s"`
}
