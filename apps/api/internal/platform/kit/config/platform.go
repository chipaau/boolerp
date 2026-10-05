package config

// Platform holds the deployment's own settings (APP_PLATFORM_*, C159).
type Platform struct {
	// Domain is the deployment's own domain, under which every tenant gets its
	// platform workspace host, <slug>.<domain> (C158): bool.mv in production,
	// bool.test in development, and a self-hosted installation's own. Lowercase,
	// without a scheme, port, or trailing dot.
	Domain string `env:"DOMAIN,required,notEmpty" validate:"fqdn,lowercase"`
}
