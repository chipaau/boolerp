package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/domain"
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
	u := domain.User{
		ID: "user-" + a.KratosIdentityID, KratosIdentityID: a.KratosIdentityID,
		Email: a.Email, Phone: a.Phone, DisplayName: a.DisplayName, AvatarURL: a.AvatarURL,
	}
	f.byKratos[a.KratosIdentityID] = u
	return u, nil
}

type fakeAccounts struct {
	accounts    map[string]domain.Account
	calls       int
	err         error
	deactivated []string
	created     []domain.NewAccount
	signIns     []string
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

// fakeProfiles answers /userinfo for known access tokens.
type fakeProfiles struct {
	byToken map[string]domain.Account
	err     error
}

func (f *fakeProfiles) Account(_ context.Context, accessToken string) (domain.Account, error) {
	if f.err != nil {
		return domain.Account{}, f.err
	}
	a, ok := f.byToken[accessToken]
	if !ok {
		return domain.Account{}, ErrTokenRefused
	}
	return a, nil
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

func (f *fakeAccounts) FindByEmail(_ context.Context, email string) (domain.Account, error) {
	if f.err != nil {
		return domain.Account{}, f.err
	}
	for _, a := range f.accounts {
		if a.Email == email {
			return a, nil
		}
	}
	return domain.Account{}, ErrNotFound
}

func (f *fakeAccounts) Create(_ context.Context, n domain.NewAccount) (domain.Account, error) {
	f.created = append(f.created, n)
	a := domain.Account{KratosIdentityID: "new-" + n.Email, Email: n.Email, Phone: n.Phone, DisplayName: n.DisplayName, Active: true}
	f.accounts[a.KratosIdentityID] = a
	return a, nil
}

func (f *fakeAccounts) AddSignIn(_ context.Context, id, password, googleSubject string) error {
	if f.err != nil {
		return f.err
	}
	f.signIns = append(f.signIns, id+"|"+password+"|"+googleSubject)
	return nil
}

func (f *fakeAccounts) Recover(_ context.Context, id string, ttl time.Duration) (domain.Recovery, error) {
	if f.err != nil {
		return domain.Recovery{}, f.err
	}
	return domain.Recovery{Link: "link-" + id, Code: "123456", ExpiresAt: time.Unix(0, 0).Add(ttl)}, nil
}

func setup() (*Service, *fakeUsers, *fakeAccounts) {
	s, users, accounts, _ := setupWithProfiles()
	return s, users, accounts
}

func setupWithProfiles() (*Service, *fakeUsers, *fakeAccounts, *fakeProfiles) {
	users := &fakeUsers{byKratos: map[string]domain.User{}}
	accounts := &fakeAccounts{accounts: map[string]domain.Account{
		"k1":       {KratosIdentityID: "k1", Email: "a@b.test", Phone: "+9607770000", DisplayName: "Aisha", Active: true},
		"disabled": {KratosIdentityID: "disabled", Email: "d@b.test", Phone: "+9607770001", Active: false},
	}}
	profiles := &fakeProfiles{byToken: map[string]domain.Account{
		"aisha-token": {
			KratosIdentityID: "k1", Email: "a@b.test", Phone: "+9607770000", DisplayName: "Aisha",
			AvatarURL: "https://example.test/aisha.png", Active: true,
		},
		"no-phone-token":    {KratosIdentityID: "k1", Email: "a@b.test", Active: true},
		"bad-picture-token": {KratosIdentityID: "k1", Email: "a@b.test", Phone: "+9607770000", AvatarURL: "javascript:alert(1)"},
	}}
	return NewService(users, accounts, &fakeLogins{}, profiles), users, accounts, profiles
}

func TestUserOnlyReads(t *testing.T) {
	s, users, accounts := setup()
	_, err := s.User(t.Context(), "k1")
	require.ErrorIs(t, err, ErrNotFound, "an account that has not registered has no user")
	assert.Empty(t, users.byKratos, "and none is created")
	assert.Zero(t, accounts.calls, "Kratos is not asked")

	users.byKratos["k1"] = domain.User{ID: "u1", KratosIdentityID: "k1"}
	u, err := s.User(t.Context(), "k1")
	require.NoError(t, err)
	assert.Equal(t, "u1", u.ID)
}

func TestRegisterCreatesThenUpdatesFromTheProfile(t *testing.T) {
	s, users, _, profiles := setupWithProfiles()
	u, err := s.Register(t.Context(), "k1", "aisha-token")
	require.NoError(t, err)
	assert.Equal(t, "a@b.test", u.Email)
	assert.Equal(t, "https://example.test/aisha.png", u.AvatarURL)
	assert.Equal(t, u, users.byKratos["k1"])

	a := profiles.byToken["aisha-token"]
	a.Phone = "+9607771111"
	profiles.byToken["aisha-token"] = a
	u, err = s.Register(t.Context(), "k1", "aisha-token")
	require.NoError(t, err)
	assert.Equal(t, "+9607771111", u.Phone, "registering again refreshes the user")
	assert.Len(t, users.byKratos, 1)
}

func TestRegisterRefusesAnotherAccountsProfile(t *testing.T) {
	s, users, _, _ := setupWithProfiles()
	_, err := s.Register(t.Context(), "someone-else", "aisha-token")
	require.ErrorIs(t, err, ErrWrongAccount)
	assert.Empty(t, users.byKratos)
}

func TestRegisterNeedsEmailAndPhone(t *testing.T) {
	s, users, _, _ := setupWithProfiles()
	_, err := s.Register(t.Context(), "k1", "no-phone-token")
	require.ErrorIs(t, err, ErrInvalidAccount)
	assert.Empty(t, users.byKratos)
}

func TestRegisterDropsAPictureThatIsNotAWebAddress(t *testing.T) {
	s, _, _, _ := setupWithProfiles()
	u, err := s.Register(t.Context(), "k1", "bad-picture-token")
	require.NoError(t, err)
	assert.Empty(t, u.AvatarURL)
}

func TestRegisterPassesOnAProfileFailure(t *testing.T) {
	s, users, _, profiles := setupWithProfiles()
	_, err := s.Register(t.Context(), "k1", "unknown-token")
	require.ErrorIs(t, err, ErrTokenRefused)

	profiles.err = errors.New("hydra down")
	_, err = s.Register(t.Context(), "k1", "aisha-token")
	require.Error(t, err)
	assert.Empty(t, users.byKratos)
}

func TestSyncUpdatesFromKratos(t *testing.T) {
	s, users, accounts := setup()
	accounts.accounts["k1"] = domain.Account{KratosIdentityID: "k1", Email: "a@b.test", Phone: "+9607771111", DisplayName: "Aisha A.", Active: true}

	u, err := s.Sync(t.Context(), "k1")
	require.NoError(t, err)
	assert.Equal(t, "+9607771111", u.Phone)
	assert.Equal(t, "Aisha A.", users.byKratos["k1"].DisplayName)
}

func TestSyncPassesOnAKratosFailure(t *testing.T) {
	s, _, accounts := setup()
	accounts.err = errors.New("unavailable")
	_, err := s.Sync(t.Context(), "k1")
	assert.Error(t, err)
}

func TestDisableDeactivatesThenRevokesLogins(t *testing.T) {
	accounts := &fakeAccounts{accounts: map[string]domain.Account{"k1": {KratosIdentityID: "k1"}}}
	logins := &fakeLogins{}
	s := NewService(&fakeUsers{byKratos: map[string]domain.User{}}, accounts, logins, &fakeProfiles{})

	require.NoError(t, s.Disable(t.Context(), "k1"))
	assert.Equal(t, []string{"k1"}, accounts.deactivated)
	assert.Equal(t, []string{"k1"}, logins.revoked)
}

func TestDisableStopsWhenKratosFails(t *testing.T) {
	accounts := &fakeAccounts{accounts: map[string]domain.Account{}}
	logins := &fakeLogins{}
	s := NewService(&fakeUsers{byKratos: map[string]domain.User{}}, accounts, logins, &fakeProfiles{})

	assert.ErrorIs(t, s.Disable(t.Context(), "unknown"), ErrNotFound)
	assert.Empty(t, logins.revoked, "nothing at Hydra for an account Kratos does not know")
}

func TestDisableReportsAHydraFailure(t *testing.T) {
	accounts := &fakeAccounts{accounts: map[string]domain.Account{"k1": {KratosIdentityID: "k1"}}}
	s := NewService(&fakeUsers{byKratos: map[string]domain.User{}}, accounts, &fakeLogins{err: errors.New("hydra down")}, &fakeProfiles{})
	assert.Error(t, s.Disable(t.Context(), "k1"))
	assert.Equal(t, []string{"k1"}, accounts.deactivated, "no one can sign in again meanwhile; retrying finishes the job")
}

func TestEnsureAccountCreatesOnceThenReuses(t *testing.T) {
	s, users, accounts := setup()
	n := domain.NewAccount{Email: "new@b.test", Phone: "+9607000001", DisplayName: "New", Password: "pw", GoogleSubject: "new@b.test"}

	u, created, err := s.EnsureAccount(t.Context(), n)
	require.NoError(t, err)
	assert.True(t, created)
	assert.Equal(t, "new@b.test", u.Email)
	assert.Contains(t, users.byKratos, "new-new@b.test", "the user is created too")

	_, created, err = s.EnsureAccount(t.Context(), n)
	require.NoError(t, err)
	assert.False(t, created, "running again creates nothing")
	assert.Len(t, accounts.created, 1)
}

func TestEnsureAccountUsesAnExistingAccount(t *testing.T) {
	s, _, accounts := setup()
	u, created, err := s.EnsureAccount(t.Context(), domain.NewAccount{Email: "a@b.test", Phone: "+9607000009"})
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, "+9607770000", u.Phone, "an existing account is left as it is")
	assert.Empty(t, accounts.created)
}

func TestEnsureAccountRefusesADisabledAccount(t *testing.T) {
	s, users, _ := setup()
	_, _, err := s.EnsureAccount(t.Context(), domain.NewAccount{Email: "d@b.test", Phone: "+9607770001"})
	require.ErrorIs(t, err, ErrNoAccount)
	assert.NotContains(t, users.byKratos, "disabled")
}

func TestEnsureAccountNeedsEmailAndPhone(t *testing.T) {
	s, _, _ := setup()
	_, _, err := s.EnsureAccount(t.Context(), domain.NewAccount{Email: "x@b.test"})
	assert.ErrorIs(t, err, ErrInvalidAccount)
}

func TestAddSignInPassesThrough(t *testing.T) {
	s, _, accounts := setup()
	require.NoError(t, s.AddSignIn(t.Context(), "k1", "pw", "a@b.test"))
	assert.Equal(t, []string{"k1|pw|a@b.test"}, accounts.signIns)
	accounts.err = errors.New("kratos down")
	assert.Error(t, s.AddSignIn(t.Context(), "k1", "pw", ""))
}

func TestRecoverIsValidForAnHour(t *testing.T) {
	s, _, accounts := setup()
	r, err := s.Recover(t.Context(), "k1")
	require.NoError(t, err)
	assert.Equal(t, "link-k1", r.Link)
	assert.Equal(t, time.Unix(0, 0).Add(time.Hour), r.ExpiresAt)
	accounts.err = errors.New("kratos down")
	_, err = s.Recover(t.Context(), "k1")
	assert.Error(t, err)
}
