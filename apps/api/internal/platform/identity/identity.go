// Package identity is the identity module (C94): our users, a projection of the
// accounts in Kratos, created and updated when the person registers with their
// access token (POST /api/auth/me, from Hydra's /userinfo, C157).
// It is the integration point with Ory's admin APIs. Its tables are in
// migrations (C48, C95); its use cases in application; its stores and
// providers in adapters.
package identity

import (
	"context"
	"embed"
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/boolmv/erp/apps/api/internal/platform/identity/adapters/hydra"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/adapters/kratos"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/application"
	"github.com/boolmv/erp/apps/api/internal/platform/identity/domain"
)

//go:embed migrations/*.sql
var migrations embed.FS

//go:embed all:policies
var policies embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "identity".
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// Policies returns the module's Cerbos policies, their tests, and their schemas
// (C151, C154), assembled as "identity".
func Policies() fs.FS {
	sub, err := fs.Sub(policies, "policies")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// Settings configure the module (from config.Identity).
type Settings struct {
	KratosAdminURL string // Kratos's admin API, internal network only
	HydraAdminURL  string // Hydra's admin API, internal network only
	HydraPublicURL string // Hydra's issuer, for /userinfo (C157); unused by seeds
}

// Module is the identity module.
type Module struct {
	service *application.Service
}

// New returns the module over the database (a pool or a transaction).
func New(db store.DB, s Settings, client *http.Client, logger *slog.Logger) *Module {
	return &Module{service: application.NewService(
		store.NewUsers(db),
		kratos.NewAccounts(s.KratosAdminURL, client),
		hydra.NewLogins(s.HydraAdminURL, client, logger),
		hydra.NewProfiles(s.HydraPublicURL, client),
	)}
}

// Errors of User and Register.
var (
	// ErrNotFound: the account has no user; the person has not registered yet.
	ErrNotFound = application.ErrNotFound
	// ErrInvalidAccount: the token's profile lacks the email or phone (scopes).
	ErrInvalidAccount = application.ErrInvalidAccount
	// ErrTokenRefused: Hydra no longer accepts the access token.
	ErrTokenRefused = application.ErrTokenRefused
	// ErrWrongAccount: /userinfo named someone other than the token's subject.
	ErrWrongAccount = application.ErrWrongAccount
)

// User returns the user for a Kratos account (a token's sub), or ErrNotFound. It
// only reads (C157).
func (m *Module) User(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	return m.service.User(ctx, kratosIdentityID)
}

// Register creates or updates the user of the person accessToken is for, from
// Hydra's /userinfo; subject is the verified token's sub (C157).
func (m *Module) Register(ctx context.Context, subject, accessToken string) (domain.User, error) {
	return m.service.Register(ctx, subject, accessToken)
}

// EnsureAccount returns the user for the account that signs in with a.Email,
// creating the account and user if needed; created reports a new account.
func (m *Module) EnsureAccount(ctx context.Context, a domain.NewAccount) (u domain.User, created bool, err error) {
	return m.service.EnsureAccount(ctx, a)
}

// AddSignIn gives an existing account a password and a Google sign-in.
func (m *Module) AddSignIn(ctx context.Context, kratosIdentityID, password, googleSubject string) error {
	return m.service.AddSignIn(ctx, kratosIdentityID, password, googleSubject)
}

// Recover returns a one-time link and code to set the account's password.
func (m *Module) Recover(ctx context.Context, kratosIdentityID string) (Recovery, error) {
	return m.service.Recover(ctx, kratosIdentityID)
}

// Recovery is a one-time recovery link and code.
type Recovery = domain.Recovery

// NewAccount is an account EnsureAccount creates.
type NewAccount = domain.NewAccount

// User is the module's user.
type User = domain.User

// Disable stops a person signing in and ends their access (C101). It has no
// HTTP route until authorization decides who may call it (roadmap step 8).
func (m *Module) Disable(ctx context.Context, kratosIdentityID string) error {
	return m.service.Disable(ctx, kratosIdentityID)
}
