package config

import (
	"time"

	"github.com/go-playground/validator/v10"
)

// BFF holds the settings of one backend-for-frontend instance (cmd/bff, C90,
// C96), such as bff-app. It reuses the API's groups for the process, logging,
// HTTP limits, and Redis connection, under BFF_ prefixes, so one container's
// variables never configure the other program.
type BFF struct {
	App     App        `envPrefix:"BFF_"`
	Log     Log        `envPrefix:"BFF_LOG_"`
	HTTP    HTTP       `envPrefix:"BFF_HTTP_"`
	Redis   Redis      `envPrefix:"BFF_REDIS_"` // the session Redis (redis-sessions), not the API's cache
	Session Session    `envPrefix:"BFF_SESSION_"`
	OIDC    OIDCClient `envPrefix:"BFF_OIDC_"`
	API     Upstream   `envPrefix:"BFF_API_"`
}

// Upstream is where the BFF forwards /api/* (BFF_API_*, C98).
type Upstream struct {
	// URL is the API's address on the internal network, such as http://api:8080.
	URL string `env:"URL,required,notEmpty" validate:"http_url"`
}

// Session holds the browser session settings (BFF_SESSION_*, C96).
type Session struct {
	// IdleTimeout ends a session after this long without a request.
	IdleTimeout time.Duration `env:"IDLE_TIMEOUT" envDefault:"30m" validate:"gt=0,max=24h"`
	// Lifetime ends a session this long after login, however active.
	Lifetime time.Duration `env:"LIFETIME" envDefault:"12h" validate:"gtfield=IdleTimeout,max=720h"`
	// CookieSecure sends the cookie over HTTPS only, names it __Host-session, and
	// makes login callbacks https://. Turn it off only for plain-HTTP development.
	CookieSecure bool `env:"COOKIE_SECURE" envDefault:"true"`
	// EncryptionKey is the contents of the file BFF_SESSION_ENCRYPTION_KEY_FILE
	// names (C80): 32 bytes as 64 hex digits (openssl rand -hex 32), the AES-256
	// key for the tokens kept in sessions. A secret: never logged.
	EncryptionKey string `env:"ENCRYPTION_KEY_FILE,file,required,notEmpty" validate:"hexadecimal,len=64"`
}

// OIDCClient holds the instance's Hydra client (BFF_OIDC_*, C96): a confidential
// OpenID Connect client that completes logins on the browser's own domain.
type OIDCClient struct {
	// Issuer is Hydra's issuer, such as http://identity.bool.test/ (C89). It must
	// match the issuer in Hydra's discovery document and ID tokens exactly.
	Issuer   string `env:"ISSUER,required,notEmpty" validate:"http_url"`
	ClientID string `env:"CLIENT_ID,required,notEmpty"`
	// ClientSecret is the contents of the file BFF_OIDC_CLIENT_SECRET_FILE names
	// (C80). A secret: never logged or echoed in errors.
	ClientSecret string `env:"CLIENT_SECRET_FILE,file,required,notEmpty"`
	// Audience is requested for the access tokens, so the API accepts them (C91).
	Audience string `env:"AUDIENCE" envDefault:"erp-api" validate:"required"`
}

// LoadBFF reads a BFF instance's settings from environ, in the os.Environ
// "KEY=value" form. Errors name the variable but never include its value.
func LoadBFF(environ []string) (BFF, error) {
	return load[BFF](environ, func(sl validator.StructLevel) {
		cfg := sl.Current().Interface().(BFF)
		// Graceful shutdown must let any request the server allows finish (C30).
		if cfg.App.ShutdownTimeout < cfg.HTTP.WriteTimeout {
			sl.ReportError(cfg.App.ShutdownTimeout, "ShutdownTimeout", "App.ShutdownTimeout", "gtefield", "HTTP.WriteTimeout")
		}
	})
}
