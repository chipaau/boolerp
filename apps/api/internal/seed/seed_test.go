package seed

import (
	"context"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/modules/identity"
)

type fakeAccounts struct {
	seen map[string]identity.NewAccount
}

func (f *fakeAccounts) EnsureAccount(_ context.Context, a identity.NewAccount) (identity.User, bool, error) {
	_, existed := f.seen[a.Email]
	f.seen[a.Email] = a
	return identity.User{Email: a.Email}, !existed, nil
}

func TestTeamAccountsInDev(t *testing.T) {
	accounts := &fakeAccounts{seen: map[string]identity.NewAccount{}}
	s := Settings{Environment: "dev", TeamPassword: "pw"}
	require.NoError(t, Run(t.Context(), s, accounts, slog.New(slog.DiscardHandler)))
	require.NoError(t, Run(t.Context(), s, accounts, slog.New(slog.DiscardHandler)), "running again is fine")

	assert.Len(t, accounts.seen, 3)
	for _, email := range []string{"ibrahim@bool.mv", "shifau@bool.mv", "mariyam@bool.mv"} {
		a := accounts.seen[email]
		assert.Equal(t, "pw", a.Password, email)
		assert.Equal(t, email, a.GoogleSubject, email)
		assert.NotEmpty(t, a.Phone, email)
	}
}

func TestTeamAccountsOnlyInDev(t *testing.T) {
	for _, env := range []string{"test", "staging"} {
		accounts := &fakeAccounts{seen: map[string]identity.NewAccount{}}
		require.NoError(t, Run(t.Context(), Settings{Environment: env, TeamPassword: "pw"}, accounts, slog.New(slog.DiscardHandler)))
		assert.Empty(t, accounts.seen, env)
	}
}

func TestDevNeedsTheTeamPassword(t *testing.T) {
	accounts := &fakeAccounts{seen: map[string]identity.NewAccount{}}
	assert.Error(t, Run(t.Context(), Settings{Environment: "dev"}, accounts, slog.New(slog.DiscardHandler)))
	assert.Empty(t, accounts.seen)
}
