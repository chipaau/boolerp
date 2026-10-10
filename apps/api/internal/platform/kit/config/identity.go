package config

// Identity holds the identity module's settings (APP_IDENTITY_*, C94, C101).
type Identity struct {
	// KratosAdminURL is Kratos's admin API, reachable only on the internal
	// network, such as http://kratos:4434.
	KratosAdminURL string `env:"KRATOS_ADMIN_URL,required,notEmpty" validate:"http_url"`
	// HydraAdminURL is Hydra's admin API, reachable only on the internal network,
	// such as http://hydra:4445.
	HydraAdminURL string `env:"HYDRA_ADMIN_URL,required,notEmpty" validate:"http_url"`
	// PortraitsURL is where the built-in portraits people may choose as their
	// picture are served (C196), such as http://identity.bool.test/portraits/;
	// empty offers none.
	PortraitsURL string `env:"PORTRAITS_URL" validate:"omitempty,http_url"`
}
