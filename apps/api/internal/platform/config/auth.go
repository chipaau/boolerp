package config

// Auth holds how the API accepts callers (APP_AUTH_*, C88, C91): Hydra access
// tokens (JWTs) sent as Authorization: Bearer, verified locally against the
// issuer's published keys.
type Auth struct {
	// Issuer is Hydra's issuer, such as http://identity.bool.test/ (C89). Tokens
	// must carry exactly this iss; its keys are read from
	// <issuer>.well-known/jwks.json.
	Issuer string `env:"ISSUER,required,notEmpty" validate:"http_url"`
	// Audience must be among the token's aud values.
	Audience string `env:"AUDIENCE" envDefault:"erp-api" validate:"required"`
}
