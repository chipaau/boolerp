package seeds

import (
	"context"
	"fmt"
	"io"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// Recoverer creates accounts and recovery codes (the identity module).
type Recoverer interface {
	Accounts
	Recover(ctx context.Context, kratosIdentityID string) (identity.Recovery, error)
}

// TeamAccounts is a deploy seeder (C135): it creates the team's accounts, with a
// verified email and no password. For each account it creates, it writes a
// one-time link and code to the terminal, with which that person sets their own
// password; whoever runs deploy never chooses or sees one. Without a terminal
// (terminal is nil), such as in CI, nothing is written and the person uses
// "Forgot password" instead. An existing account is left as it is.
type TeamAccounts struct {
	accounts Recoverer
	terminal io.Writer
}

// NewTeamAccounts returns the seeder; terminal is where recovery codes go, or nil.
func NewTeamAccounts(accounts Recoverer, terminal io.Writer) *TeamAccounts {
	return &TeamAccounts{accounts: accounts, terminal: terminal}
}

// Name implements seed.Seeder.
func (*TeamAccounts) Name() string { return "identity.team_accounts" }

// Run implements seed.Seeder.
func (s *TeamAccounts) Run(ctx context.Context, env seed.Env) error {
	var created, existing int
	for _, m := range team {
		u, isNew, err := s.accounts.EnsureAccount(ctx, identity.NewAccount{
			Email: m.email, Phone: m.phone, DisplayName: m.name,
		})
		if err != nil {
			return fmt.Errorf("team account %s: %w", m.name, err)
		}
		if !isNew {
			existing++
			continue
		}
		created++
		if s.terminal == nil {
			continue
		}
		r, err := s.accounts.Recover(ctx, u.KratosIdentityID)
		if err != nil {
			return fmt.Errorf("team account %s: %w", m.name, err)
		}
		// The terminal only: the code is a secret and the email personal data,
		// so neither goes to the log.
		_, _ = fmt.Fprintf(s.terminal, "%s (%s): set a password at %s with code %s, before %s\n",
			m.name, m.email, r.Link, r.Code, r.ExpiresAt.Format("2006-01-02 15:04 MST"))
	}
	// Counts only: emails are personal data, never logged (C94).
	env.Logger.InfoContext(ctx, "team accounts ensured", "created", created, "existing", existing,
		"recovery_codes_shown", s.terminal != nil && created > 0)
	return nil
}
