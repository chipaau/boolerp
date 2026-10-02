// Package seed runs seeders (C50), like Laravel's seeders: each module keeps
// one seeder per store in its seeds folder, and the edition lists them in
// order, as it lists migrations (C95). cmd/seed runs the list. Seeders create
// data through their module's use cases, so seeded data passes the same rules
// as real data, and every seeder can run repeatedly without duplicating.
package seed

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/brianvoe/gofakeit/v7"
)

// Seeder seeds one store.
type Seeder interface {
	// Name identifies the seeder in logs and errors, such as "identity.users".
	Name() string
	// Run seeds the store for env; it must be safe to run again.
	Run(ctx context.Context, env Env) error
}

// Env is what every seeder gets.
type Env struct {
	// Environment is dev, test, or staging (never prod, config.SeedApp).
	Environment string
	// Fake generates data (github.com/brianvoe/gofakeit). It is seeded with a
	// fixed value, so every run generates the same data.
	Fake *gofakeit.Faker
	// Logger logs counts, never personal data.
	Logger *slog.Logger
}

// fakeSeed fixes the generated data across runs.
const fakeSeed = 1

// NewEnv returns the Env for environment.
func NewEnv(environment string, logger *slog.Logger) Env {
	return Env{Environment: environment, Fake: gofakeit.New(fakeSeed), Logger: logger}
}

// Run runs the seeders in order, stopping at the first failure.
func Run(ctx context.Context, seeders []Seeder, env Env) error {
	for _, s := range seeders {
		if err := s.Run(ctx, Env{Environment: env.Environment, Fake: env.Fake, Logger: env.Logger.With("seeder", s.Name())}); err != nil {
			return fmt.Errorf("seed %s: %w", s.Name(), err)
		}
	}
	return nil
}
