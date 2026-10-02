package seeds

import (
	"context"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

type fakeAccounts struct {
	seen map[string]identity.NewAccount
}

func (f *fakeAccounts) EnsureAccount(_ context.Context, a identity.NewAccount) (identity.User, bool, error) {
	_, existed := f.seen[a.Email]
	f.seen[a.Email] = a
	return identity.User{Email: a.Email}, !existed, nil
}

func env(environment string) seed.Env {
	return seed.NewEnv(environment, slog.New(slog.DiscardHandler))
}

func TestTeamAccountsInDev(t *testing.T) {
	accounts := &fakeAccounts{seen: map[string]identity.NewAccount{}}
	users := NewUsers(accounts)
	require.NoError(t, users.Run(t.Context(), env("dev")))
	require.NoError(t, users.Run(t.Context(), env("dev")), "running again is fine")

	assert.Len(t, accounts.seen, 3)
	for _, email := range []string{"ibrahim@bool.mv", "shifau@bool.mv", "mariyam@bool.mv"} {
		a := accounts.seen[email]
		assert.Equal(t, "password", a.Password, email)
		assert.Equal(t, email, a.GoogleSubject, email)
		assert.NotEmpty(t, a.Phone, email)
	}
}

func TestTeamAccountsOnlyInDev(t *testing.T) {
	for _, e := range []string{"test", "staging"} {
		accounts := &fakeAccounts{seen: map[string]identity.NewAccount{}}
		require.NoError(t, NewUsers(accounts).Run(t.Context(), env(e)))
		assert.Empty(t, accounts.seen, e)
	}
}
