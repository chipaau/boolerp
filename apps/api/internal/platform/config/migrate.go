package config

// Migrate holds the settings of cmd/migrate (MIGRATE_*). The API never loads
// them, and cmd/migrate never loads the API's APP_* settings (C47).
type Migrate struct {
	DB MigrateDB `envPrefix:"MIGRATE_DB_"`
}

// MigrateDB is the PostgreSQL connection for the migration role, which can
// create and alter schema objects. It is separate from APP_DB_* because it is a
// different role with different credentials, and because migrations may need a
// different endpoint: they must connect directly, not through a transaction
// pooler such as PgBouncer, which breaks DDL and Goose's session lock.
type MigrateDB struct {
	Host     string `env:"HOST,required,notEmpty" validate:"hostname_rfc1123|ip"`
	Port     int    `env:"PORT" envDefault:"5432" validate:"min=1,max=65535"`
	Name     string `env:"NAME,required,notEmpty"`
	User     string `env:"USER,required,notEmpty"`
	Password string `env:"PASSWORD,required,notEmpty"`
	SSLMode  string `env:"SSLMODE" envDefault:"verify-full" validate:"oneof=disable require verify-ca verify-full"`
}

// LoadMigrate reads cmd/migrate's settings from environ. Errors name the
// variable but never include its value.
func LoadMigrate(environ []string) (Migrate, error) {
	return load[Migrate](environ, nil)
}
