package config

// Deploy holds cmd/deploy's settings (C135). Deploy applies the migrations and
// then production's starting data, as the migration role that owns the tables, so
// it uses the same MIGRATE_DB_* connection as cmd/migrate; APP_ENV labels its logs and tells seeders
// where they run, and unlike cmd/seed it includes prod.
type Deploy struct {
	App DeployApp `envPrefix:"APP_"`
	DB  MigrateDB `envPrefix:"MIGRATE_DB_"`
	// Identity reaches Kratos's admin API to create the team's accounts.
	Identity Identity `envPrefix:"APP_IDENTITY_"`
}

// DeployApp names the environment; it must be set explicitly.
type DeployApp struct {
	Environment string `env:"ENV,required,notEmpty" validate:"oneof=dev test staging prod"`
}

// LoadDeploy reads cmd/deploy's settings from environ. Errors name the variable
// but never include its value.
func LoadDeploy(environ []string) (Deploy, error) {
	return load[Deploy](environ, nil)
}
