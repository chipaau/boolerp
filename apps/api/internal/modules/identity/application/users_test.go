package application

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/modules/identity/domain"
)

type fakeUsers struct{ byKratos map[string]domain.User }

func (f *fakeUsers) ByKratosID(_ context.Context, id string) (domain.User, error) {
	u, ok := f.byKratos[id]
	if !ok {
		return domain.User{}, ErrNotFound
	}
	return u, nil
}

func (f *fakeUsers) Save(_ context.Context, a domain.Account) (domain.User, error) {
	u := domain.User{ID: "user-" + a.KratosIdentityID, KratosIdentityID: a.KratosIdentityID, Email: a.Email, Phone: a.Phone, DisplayName: a.DisplayName}
	f.byKratos[a.KratosIdentityID] = u
	return u, nil
}

type fakeAccounts struct {
	accounts map[string]domain.Account
	calls    int
	err      error
}

func (f *fakeAccounts) Get(_ context.Context, id string) (domain.Account, error) {
	f.calls++
	if f.err != nil {
		return domain.Account{}, f.err
	}
	a, ok := f.accounts[id]
	if !ok {
		return domain.Account{}, ErrNotFound
	}
	return a, nil
}

func setup() (*Service, *fakeUsers, *fakeAccounts) {
	users := &fakeUsers{byKratos: map[string]domain.User{}}
	accounts := &fakeAccounts{accounts: map[string]domain.Account{
		"k1": {KratosIdentityID: "k1", Email: "a@b.test", Phone: "+9607770000", DisplayName: "Aisha"},
	}}
	return NewService(users, accounts), users, accounts
}

func TestResolveCreatesTheUserOnFirstUse(t *testing.T) {
	s, users, accounts := setup()
	u, err := s.Resolve(t.Context(), "k1")
	require.NoError(t, err)
	assert.Equal(t, "a@b.test", u.Email)
	assert.Equal(t, 1, accounts.calls)
	assert.Contains(t, users.byKratos, "k1")
}

func TestResolveUsesTheStoredUser(t *testing.T) {
	s, _, accounts := setup()
	_, err := s.Resolve(t.Context(), "k1")
	require.NoError(t, err)
	_, err = s.Resolve(t.Context(), "k1")
	require.NoError(t, err)
	assert.Equal(t, 1, accounts.calls, "Kratos is read only for an unknown user")
}

func TestResolveUnknownAccount(t *testing.T) {
	s, _, _ := setup()
	_, err := s.Resolve(t.Context(), "nobody")
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestSyncUpdatesFromKratos(t *testing.T) {
	s, users, accounts := setup()
	_, err := s.Resolve(t.Context(), "k1")
	require.NoError(t, err)
	accounts.accounts["k1"] = domain.Account{KratosIdentityID: "k1", Email: "a@b.test", Phone: "+9607771111", DisplayName: "Aisha A."}

	u, err := s.Sync(t.Context(), "k1")
	require.NoError(t, err)
	assert.Equal(t, "+9607771111", u.Phone)
	assert.Equal(t, "Aisha A.", users.byKratos["k1"].DisplayName)
}

func TestKratosFailurePropagates(t *testing.T) {
	s, _, accounts := setup()
	accounts.err = errors.New("unavailable")
	_, err := s.Resolve(t.Context(), "k1")
	assert.Error(t, err)
}
