// Package application holds the identity module's use cases. It depends on
// ports (Users, Accounts, Logins, Profiles), never on PostgreSQL, Kratos, or Hydra
// directly.
package application

import (
	"context"
	"errors"
	"time"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/domain"
)

// Users stores users (adapters/store implements it).
type Users interface {
	// ByKratosID returns the user mapped to a Kratos account, or ErrNotFound.
	ByKratosID(ctx context.Context, kratosIdentityID string) (domain.User, error)
	// Save creates or updates the user for an account, keyed by its Kratos ID.
	Save(ctx context.Context, a domain.Account) (domain.User, error)
}

// Accounts are the accounts in Kratos (adapters/kratos implements it).
type Accounts interface {
	Get(ctx context.Context, kratosIdentityID string) (domain.Account, error)
	// FindByEmail returns the account that signs in with email, or ErrNotFound.
	FindByEmail(ctx context.Context, email string) (domain.Account, error)
	// Create creates an active account with a verified email.
	Create(ctx context.Context, a domain.NewAccount) (domain.Account, error)
	// Deactivate stops the account signing in and ends its Kratos sessions.
	Deactivate(ctx context.Context, kratosIdentityID string) error
	// AddSignIn gives the account a password and a Google sign-in (either may be
	// empty), keeping everything else about it.
	AddSignIn(ctx context.Context, kratosIdentityID, password, googleSubject string) error
	// Recover returns a one-time recovery link and code for the account, valid
	// for ttl.
	Recover(ctx context.Context, kratosIdentityID string, ttl time.Duration) (domain.Recovery, error)
}

// Logins are a person's logins at Hydra (adapters/hydra implements it).
type Logins interface {
	// RevokeAll ends the subject's login sessions, which Hydra announces to each
	// client (back-channel logout), and its consent sessions, which revokes its
	// refresh tokens.
	RevokeAll(ctx context.Context, subject string) error
}

// Profiles are what Hydra's /userinfo says about the person an access token is
// for (adapters/hydra implements it, C157): the claims granted at consent.
type Profiles interface {
	// Account returns the token's person as an Account (KratosIdentityID is the
	// sub), or ErrTokenRefused when Hydra does not accept the token.
	Account(ctx context.Context, accessToken string) (domain.Account, error)
}

// ErrNotFound is returned by Users.ByKratosID and User for an account without a
// user, and by Accounts.Get when Kratos has no such account.
var ErrNotFound = errors.New("identity: not found")

// ErrNoAccount is returned by EnsureAccount for a disabled account.
var ErrNoAccount = errors.New("identity: no usable account")

// ErrTokenRefused is returned by Register when Hydra does not accept the access
// token (expired or revoked).
var ErrTokenRefused = errors.New("identity: the access token was refused")

// ErrWrongAccount is returned by Register when /userinfo names a different
// person than the token's subject.
var ErrWrongAccount = errors.New("identity: the profile is for another account")

// Service is the identity use cases.
type Service struct {
	users    Users
	accounts Accounts
	logins   Logins
	profiles Profiles
}

// NewService returns the use cases over the given stores.
func NewService(users Users, accounts Accounts, logins Logins, profiles Profiles) *Service {
	return &Service{users: users, accounts: accounts, logins: logins, profiles: profiles}
}

// Disable stops a person signing in and ends their access (C101): the Kratos
// account becomes inactive and loses its sessions, so no new login starts; then
// Hydra's logins and refresh tokens end, so browsers are signed out at once
// (their BFFs get back-channel logout). An access token already issued to
// another client works until it expires (at most 10 minutes, C91).
func (s *Service) Disable(ctx context.Context, kratosIdentityID string) error {
	if err := s.accounts.Deactivate(ctx, kratosIdentityID); err != nil {
		return err
	}
	return s.logins.RevokeAll(ctx, kratosIdentityID)
}

// User returns the user for a Kratos account (a token's sub), or ErrNotFound
// when the person has not registered yet. It only reads (C157): a user is
// created by Register, never as a side effect of a request.
func (s *Service) User(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	return s.users.ByKratosID(ctx, kratosIdentityID)
}

// Register creates or updates the user of the person an access token is for,
// from what Hydra's /userinfo says about them (C157); calling it again with the
// same details changes nothing but updated_at. subject is the verified token's
// sub, which /userinfo must name too. A token without the email and phone
// claims (its client did not ask for the email and phone scopes) gets
// ErrInvalidAccount; a picture that is not an http(s) address is dropped.
func (s *Service) Register(ctx context.Context, subject, accessToken string) (domain.User, error) {
	a, err := s.profiles.Account(ctx, accessToken)
	if err != nil {
		return domain.User{}, err
	}
	if a.KratosIdentityID != subject {
		return domain.User{}, ErrWrongAccount
	}
	return s.save(ctx, a)
}

// save stores an account's user after checking what the users table requires.
func (s *Service) save(ctx context.Context, a domain.Account) (domain.User, error) {
	if a.Email == "" || a.Phone == "" {
		return domain.User{}, ErrInvalidAccount
	}
	if !domain.ValidAvatarURL(a.AvatarURL) {
		a.AvatarURL = ""
	}
	return s.users.Save(ctx, a)
}

// Sync copies a Kratos account into its user, creating it if needed.
func (s *Service) Sync(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	a, err := s.accounts.Get(ctx, kratosIdentityID)
	if err != nil {
		return domain.User{}, err
	}
	return s.users.Save(ctx, a)
}

// ErrInvalidAccount is returned by EnsureAccount for an account without an
// email or phone, which Kratos's schema requires (C85).
var ErrInvalidAccount = errors.New("identity: an account needs an email and a phone")

// EnsureAccount returns the user for the account that signs in with a.Email,
// creating the Kratos account (verified, active) if it does not exist and
// saving its user; created reports whether the account was new. An existing
// account is left as it is; a disabled one gets ErrNoAccount. Seeds and
// provisioning use it (C50, C116).
func (s *Service) EnsureAccount(ctx context.Context, a domain.NewAccount) (u domain.User, created bool, err error) {
	if a.Email == "" || a.Phone == "" {
		return domain.User{}, false, ErrInvalidAccount
	}
	account, err := s.accounts.FindByEmail(ctx, a.Email)
	if errors.Is(err, ErrNotFound) {
		account, err = s.accounts.Create(ctx, a)
		created = err == nil
	}
	if err != nil {
		return domain.User{}, false, err
	}
	if !account.Active {
		return domain.User{}, false, ErrNoAccount
	}
	u, err = s.save(ctx, account)
	return u, created, err
}

// AddSignIn gives an existing account a password and a Google sign-in, such as
// the development stand-in's (seeds, C50).
func (s *Service) AddSignIn(ctx context.Context, kratosIdentityID, password, googleSubject string) error {
	return s.accounts.AddSignIn(ctx, kratosIdentityID, password, googleSubject)
}

// RecoveryTTL is how long a recovery link and code stay valid.
const RecoveryTTL = time.Hour

// Recover returns a one-time link and code with which the account's owner sets a
// password: how an account created without one is first used (C135).
func (s *Service) Recover(ctx context.Context, kratosIdentityID string) (domain.Recovery, error) {
	return s.accounts.Recover(ctx, kratosIdentityID, RecoveryTTL)
}
