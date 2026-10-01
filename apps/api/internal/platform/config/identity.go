package config

// Identity holds the identity module's settings (APP_IDENTITY_*, C94).
type Identity struct {
	// KratosAdminURL is Kratos's admin API, reachable only on the internal
	// network, such as http://kratos:4434.
	KratosAdminURL string `env:"KRATOS_ADMIN_URL,required,notEmpty" validate:"http_url"`
}
