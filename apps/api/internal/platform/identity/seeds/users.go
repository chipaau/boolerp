// Package seeds holds the identity module's seeders, one per store (C50).
package seeds

import (
	"context"
	"fmt"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// Accounts creates accounts and their users (the identity module).
type Accounts interface {
	EnsureAccount(ctx context.Context, a identity.NewAccount) (identity.User, bool, error)
}

// SignIns creates accounts and gives existing ones a password and Google sign-in.
type SignIns interface {
	Accounts
	AddSignIn(ctx context.Context, kratosIdentityID, password, googleSubject string) error
}

// Users is a demo seeder (C135): in dev it gives the team's accounts (team.go)
// the development password and the Google stand-in sign-in, creating any that
// deploy has not.
type Users struct {
	accounts SignIns
}

// NewUsers returns the users seeder.
func NewUsers(accounts SignIns) *Users {
	return &Users{accounts: accounts}
}

// teamPassword is the team accounts' password: a public development value, not
// a secret, which is why they are seeded only in dev.
const teamPassword = "password"

// Name implements seed.Seeder.
func (*Users) Name() string { return "identity.users" }

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
		// The development Google stand-in signs in with the email as username.
		user, isNew, err := u.accounts.EnsureAccount(ctx, identity.NewAccount{
			Email: m.email, Phone: m.phone, DisplayName: m.name,
			Password: teamPassword, GoogleSubject: m.email,
		})
		if err != nil {
			return fmt.Errorf("team account %s: %w", m.name, err)
		}
		if isNew {
			created++
			continue
		}
		// Deploy created it without a password; add the development sign-ins.
		if err := u.accounts.AddSignIn(ctx, user.KratosIdentityID, teamPassword, m.email); err != nil {
			return fmt.Errorf("team account %s: %w", m.name, err)
		}
		existing++
	}
	// Counts only: emails are personal data, never logged (C94).
	env.Logger.InfoContext(ctx, "team accounts seeded", "created", created, "existing", existing)
	return nil
}
