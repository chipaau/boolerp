package seeds

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/identity"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// fakeAccounts stands in for the identity module: accounts by email.
type fakeAccounts struct {
	seen      map[string]identity.NewAccount
	signIns   map[string]string // Kratos ID → password added later
	recovered []string
	err       error
}

func newFake() *fakeAccounts {
	return &fakeAccounts{seen: map[string]identity.NewAccount{}, signIns: map[string]string{}}
}

func (f *fakeAccounts) EnsureAccount(_ context.Context, a identity.NewAccount) (identity.User, bool, error) {
	if f.err != nil {
		return identity.User{}, false, f.err
	}
	_, existed := f.seen[a.Email]
	if !existed {
		f.seen[a.Email] = a
	}
	return identity.User{KratosIdentityID: "k-" + a.Email, Email: a.Email}, !existed, nil
}

func (f *fakeAccounts) AddSignIn(_ context.Context, id, password, googleSubject string) error {
	f.signIns[id] = password + "|" + googleSubject
	return nil
}

func (f *fakeAccounts) Recover(_ context.Context, id string) (identity.Recovery, error) {
	f.recovered = append(f.recovered, id)
	return identity.Recovery{Link: "http://identity.test/recovery?flow=1", Code: "123456",
		ExpiresAt: time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)}, nil
}

func env(environment string) seed.Env {
	return seed.NewEnv(environment, slog.New(slog.DiscardHandler))
}

var teamEmails = []string{"shifau@bool.mv", "mariyam@bool.mv", "ibrahim@bool.mv"}

func TestTeamAccountsInDev(t *testing.T) {
	accounts := newFake()
	users := NewUsers(accounts)
	require.NoError(t, users.Run(t.Context(), env("dev")))
	assert.Len(t, accounts.seen, 3)
	for _, email := range teamEmails {
		a := accounts.seen[email]
		assert.Equal(t, "password", a.Password, email)
		assert.Equal(t, email, a.GoogleSubject, email)
		assert.NotEmpty(t, a.Phone, email)
		assert.NotEmpty(t, a.DisplayName, email)
	}
	assert.Empty(t, accounts.signIns, "new accounts get their sign-ins when created")

	require.NoError(t, users.Run(t.Context(), env("dev")), "running again is fine")
	for _, email := range teamEmails {
		assert.Equal(t, "password|"+email, accounts.signIns["k-"+email], "existing accounts get the sign-ins")
	}
}

func TestDemoSeederAddsSignInsToAccountsDeployCreated(t *testing.T) {
	accounts := newFake()
	require.NoError(t, NewTeamAccounts(accounts, nil).Run(t.Context(), env("dev")))
	require.NoError(t, NewUsers(accounts).Run(t.Context(), env("dev")))
	for _, email := range teamEmails {
		assert.Empty(t, accounts.seen[email].Password, "deploy creates no password")
		assert.Equal(t, "password|"+email, accounts.signIns["k-"+email])
	}
}

func TestTeamAccountsOnlyInDev(t *testing.T) {
	for _, e := range []string{"test", "staging"} {
		accounts := newFake()
		require.NoError(t, NewUsers(accounts).Run(t.Context(), env(e)))
		assert.Empty(t, accounts.seen, e)
	}
}

func TestDeployCreatesTheTeamWithoutPasswordsAndShowsCodes(t *testing.T) {
	accounts := newFake()
	var terminal bytes.Buffer
	s := NewTeamAccounts(accounts, &terminal)
	assert.Equal(t, "identity.team_accounts", s.Name())
	require.NoError(t, s.Run(t.Context(), env("prod")))

	assert.Len(t, accounts.seen, 3)
	for _, email := range teamEmails {
		a := accounts.seen[email]
		assert.Empty(t, a.Password, email)
		assert.Empty(t, a.GoogleSubject, email)
		assert.NotEmpty(t, a.Phone, email)
		assert.Contains(t, terminal.String(), email)
	}
	assert.Len(t, accounts.recovered, 3)
	assert.Contains(t, terminal.String(), "http://identity.test/recovery?flow=1 with code 123456")

	terminal.Reset()
	require.NoError(t, s.Run(t.Context(), env("prod")))
	assert.Empty(t, terminal.String(), "existing accounts are left as they are")
	assert.Len(t, accounts.recovered, 3)
}

func TestDeployWithoutATerminalShowsNoCodes(t *testing.T) {
	accounts := newFake()
	require.NoError(t, NewTeamAccounts(accounts, nil).Run(t.Context(), env("prod")))
	assert.Len(t, accounts.seen, 3)
	assert.Empty(t, accounts.recovered)
}

func TestSeederFailuresNameTheMember(t *testing.T) {
	accounts := newFake()
	accounts.err = errors.New("kratos down")
	err := NewTeamAccounts(accounts, nil).Run(t.Context(), env("prod"))
	require.ErrorContains(t, err, "Ahmed Shifau")
	require.Error(t, NewUsers(accounts).Run(t.Context(), env("dev")))
}
