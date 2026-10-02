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
	accounts    map[string]domain.Account
	calls       int
	err         error
	deactivated []string
}

func (f *fakeAccounts) Deactivate(_ context.Context, id string) error {
	if f.err != nil {
		return f.err
	}
	if _, ok := f.accounts[id]; !ok {
		return ErrNotFound
	}
	f.deactivated = append(f.deactivated, id)
	return nil
}

// fakeLogins records revoked subjects.
type fakeLogins struct {
	revoked []string
	err     error
}

func (f *fakeLogins) RevokeAll(_ context.Context, subject string) error {
	if f.err != nil {
		return f.err
	}
	f.revoked = append(f.revoked, subject)
	return nil
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
	return NewService(users, accounts, &fakeLogins{}), users, accounts
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

func TestDisableDeactivatesThenRevokesLogins(t *testing.T) {
	accounts := &fakeAccounts{accounts: map[string]domain.Account{"k1": {KratosIdentityID: "k1"}}}
	logins := &fakeLogins{}
	s := NewService(&fakeUsers{byKratos: map[string]domain.User{}}, accounts, logins)

	require.NoError(t, s.Disable(t.Context(), "k1"))
	assert.Equal(t, []string{"k1"}, accounts.deactivated)
	assert.Equal(t, []string{"k1"}, logins.revoked)
}

func TestDisableStopsWhenKratosFails(t *testing.T) {
	accounts := &fakeAccounts{accounts: map[string]domain.Account{}}
	logins := &fakeLogins{}
	s := NewService(&fakeUsers{byKratos: map[string]domain.User{}}, accounts, logins)

	assert.ErrorIs(t, s.Disable(t.Context(), "unknown"), ErrNotFound)
	assert.Empty(t, logins.revoked, "nothing at Hydra for an account Kratos does not know")
}

func TestDisableReportsAHydraFailure(t *testing.T) {
	accounts := &fakeAccounts{accounts: map[string]domain.Account{"k1": {KratosIdentityID: "k1"}}}
	s := NewService(&fakeUsers{byKratos: map[string]domain.User{}}, accounts, &fakeLogins{err: errors.New("hydra down")})
	assert.Error(t, s.Disable(t.Context(), "k1"))
	assert.Equal(t, []string{"k1"}, accounts.deactivated, "no one can sign in again meanwhile; retrying finishes the job")
}
