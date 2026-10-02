// Package application holds the identity module's use cases. It depends on
// ports (Users, Accounts, Logins), never on PostgreSQL, Kratos, or Hydra directly.
package application

import (
	"context"
	"errors"

	"github.com/boolmv/erp/apps/api/internal/modules/identity/domain"
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
	// Deactivate stops the account signing in and ends its Kratos sessions.
	Deactivate(ctx context.Context, kratosIdentityID string) error
}

// Logins are a person's logins at Hydra (adapters/hydra implements it).
type Logins interface {
	// RevokeAll ends the subject's login sessions, which Hydra announces to each
	// client (back-channel logout), and its consent sessions, which revokes its
	// refresh tokens.
	RevokeAll(ctx context.Context, subject string) error
}

// ErrNotFound is returned by Users.ByKratosID for an unknown account, and by
// Accounts.Get when Kratos has no such account.
var ErrNotFound = errors.New("identity: not found")

// Service is the identity use cases.
type Service struct {
	users    Users
	accounts Accounts
	logins   Logins
}

// NewService returns the use cases over the given stores.
func NewService(users Users, accounts Accounts, logins Logins) *Service {
	return &Service{users: users, accounts: accounts, logins: logins}
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

// Resolve returns the user for a Kratos account, creating it from the account
// on first use (C94).
func (s *Service) Resolve(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	u, err := s.users.ByKratosID(ctx, kratosIdentityID)
	if err == nil {
		return u, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return domain.User{}, err
	}
	return s.Sync(ctx, kratosIdentityID)
}

// Sync copies a Kratos account into its user, creating it if needed. Resolve
// calls it on first use.
func (s *Service) Sync(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	a, err := s.accounts.Get(ctx, kratosIdentityID)
	if err != nil {
		return domain.User{}, err
	}
	return s.users.Save(ctx, a)
}
