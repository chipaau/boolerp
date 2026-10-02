// Package seeds holds the identity module's seeders, one per store (C50).
package seeds

import (
	"context"
	"fmt"

	"github.com/boolmv/erp/apps/api/internal/modules/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/seed"
)

// Accounts creates accounts and their users (the identity module).
type Accounts interface {
	EnsureAccount(ctx context.Context, a identity.NewAccount) (identity.User, bool, error)
}

// Users seeds accounts and their users: the team's development accounts.
type Users struct {
	accounts Accounts
}

// NewUsers returns the users seeder.
func NewUsers(accounts Accounts) *Users {
	return &Users{accounts: accounts}
}

// teamPassword is the team accounts' password: a public development value, not
// a secret, which is why they are seeded only in dev.
const teamPassword = "password"

// Name implements seed.Seeder.
func (*Users) Name() string { return "identity.users" }

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

// Run implements seed.Seeder.
func (u *Users) Run(ctx context.Context, env seed.Env) error {
	if env.Environment != "dev" {
		// The team accounts' password is public, so they exist only in local
		// development.
		env.Logger.InfoContext(ctx, "team accounts are seeded only in dev; skipped")
		return nil
	}
	var created, existing int
	for _, m := range team {
		_, isNew, err := u.accounts.EnsureAccount(ctx, identity.NewAccount{
			Email: m.email, Phone: m.phone, DisplayName: m.name,
			Password: teamPassword,
			// The development Google stand-in signs in with the email as username.
			GoogleSubject: m.email,
		})
		if err != nil {
			return fmt.Errorf("team account %s: %w", m.name, err)
		}
		if isNew {
			created++
		} else {
			existing++
		}
	}
	// Counts only: emails are personal data, never logged (C94).
	env.Logger.InfoContext(ctx, "team accounts seeded", "created", created, "existing", existing)
	return nil
}
