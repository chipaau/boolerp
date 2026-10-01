package config

// Identity holds the identity module's settings (APP_IDENTITY_*, C94).
type Identity struct {
	// KratosAdminURL is Kratos's admin API, reachable only on the internal
	// network, such as http://kratos:4434.
	KratosAdminURL string `env:"KRATOS_ADMIN_URL,required,notEmpty" validate:"http_url"`
	// WebhookKey is the contents of the file APP_IDENTITY_WEBHOOK_KEY_FILE names
	// (C80): the secret Kratos sends with its web hook. A secret: never logged.
	WebhookKey string `env:"WEBHOOK_KEY_FILE,file,required,notEmpty" validate:"required,min=32"`
}
