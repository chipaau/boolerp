package config

// Seed holds cmd/seed's settings (C50). It runs as the API's runtime role, so
// seeded data passes the same rules as data the API writes.
type Seed struct {
	App      SeedApp  `envPrefix:"APP_"`
	DB       DB       `envPrefix:"APP_DB_"`
	Identity Identity `envPrefix:"APP_IDENTITY_"`
}

// SeedApp is the seed guard: APP_ENV must be set explicitly (the API's dev
// default does not apply), and never to prod.
type SeedApp struct {
	Environment string `env:"ENV,required,notEmpty" validate:"oneof=dev test staging"`
}

// LoadSeed reads cmd/seed's settings from environ. Errors name the variable but
// never include its value.
func LoadSeed(environ []string) (Seed, error) {
	return load[Seed](environ, nil)
}
