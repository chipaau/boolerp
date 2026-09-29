package config

import "time"

// HTTP holds HTTP server settings (APP_HTTP_*).
type HTTP struct {
	MaxBodyBytes int64 `env:"MAX_BODY_BYTES" envDefault:"1048576" validate:"min=1,max=104857600"`

	// Headers must arrive within the full read timeout, and the write timeout
	// must exceed the read timeout to leave room for an error response.
	ReadHeaderTimeout time.Duration `env:"READ_HEADER_TIMEOUT" envDefault:"5s" validate:"gt=0,max=1m,ltefield=ReadTimeout"`
	ReadTimeout       time.Duration `env:"READ_TIMEOUT" envDefault:"15s" validate:"gt=0,max=5m"`
	WriteTimeout      time.Duration `env:"WRITE_TIMEOUT" envDefault:"30s" validate:"gt=0,max=10m,gtfield=ReadTimeout"`
	IdleTimeout       time.Duration `env:"IDLE_TIMEOUT" envDefault:"60s" validate:"gt=0,max=10m"`

	// TrustedProxyHops is the number of reverse proxies in front of the API that
	// append to X-Forwarded-For (C40). 0 trusts no forwarded header.
	TrustedProxyHops int `env:"TRUSTED_PROXY_HOPS" envDefault:"0" validate:"min=0,max=10"`
	// AllowedOrigins are the browser origins ("scheme://host[:port]") allowed to
	// call the API cross-origin (C41). Empty allows none; "*" is rejected.
	AllowedOrigins []string `env:"ALLOWED_ORIGINS" validate:"dive,origin"`
}
