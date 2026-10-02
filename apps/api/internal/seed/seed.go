// Package seed creates development and test data through the modules' use
// cases (C50), so seeded data passes the same rules as real data. cmd/seed runs
// it; it is not part of the production image. Every seed can run repeatedly
// without duplicating anything.
package seed

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/boolmv/erp/apps/api/internal/modules/identity"
)

// Accounts creates accounts and their users (the identity module).
type Accounts interface {
	EnsureAccount(ctx context.Context, a identity.NewAccount) (identity.User, bool, error)
}

// Settings configure the seeds.
type Settings struct {
	Environment  string // dev, test, or staging (config.SeedApp)
	TeamPassword string // the team accounts' password, dev only
}

// teamAccount is a team member's development account. The team's own work
// emails are seeded at the user's request (C50); the phones are placeholders.
type teamAccount struct {
	email, name, phone string
}

var team = []teamAccount{
	{"ibrahim@bool.mv", "Ibrahim", "+9607000001"},
	{"shifau@bool.mv", "Shifau", "+9607000002"},
	{"mariyam@bool.mv", "Mariyam", "+9607000003"},
}

// Run seeds the data for s.Environment.
func Run(ctx context.Context, s Settings, accounts Accounts, logger *slog.Logger) error {
	if s.Environment != "dev" {
		// The team accounts' password is public, so they exist only in local
		// development.
		logger.InfoContext(ctx, "team accounts are seeded only in dev; skipped")
		return nil
	}
	if s.TeamPassword == "" {
		return errors.New("seed: SEED_TEAM_PASSWORD_FILE is required in dev")
	}
	var created, existing int
	for _, m := range team {
		_, isNew, err := accounts.EnsureAccount(ctx, identity.NewAccount{
			Email: m.email, Phone: m.phone, DisplayName: m.name,
			Password: s.TeamPassword,
			// The development Google stand-in signs in with the email as username.
			GoogleSubject: m.email,
		})
		if err != nil {
			return fmt.Errorf("seed: team account %s: %w", m.name, err)
		}
		if isNew {
			created++
		} else {
			existing++
		}
	}
	// Counts only: emails are personal data, never logged (C94).
	logger.InfoContext(ctx, "team accounts seeded", "created", created, "existing", existing)
	return nil
}
