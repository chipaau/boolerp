// Package identity is the identity module (C94): our users, a projection of the
// accounts in Kratos, created on a person's first authenticated request and
// refreshed from Kratos whenever it is synced.
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

	"github.com/boolmv/erp/apps/api/internal/modules/identity/adapters/hydra"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/adapters/kratos"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/application"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/domain"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Migrations returns the module's tables, applied by cmd/migrate as "identity".
func Migrations() fs.FS {
	sub, err := fs.Sub(migrations, "migrations")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// Settings configure the module (from config.Identity).
type Settings struct {
	KratosAdminURL string // Kratos's admin API, internal network only
	HydraAdminURL  string // Hydra's admin API, internal network only
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
	)}
}

// ErrNoAccount is returned by Resolve for a deleted or disabled account that
// has no user yet.
var ErrNoAccount = application.ErrNoAccount

// Resolve returns the user for a Kratos account (a token's sub), creating it on
// first use; a deleted or disabled account gets ErrNoAccount.
func (m *Module) Resolve(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	return m.service.Resolve(ctx, kratosIdentityID)
}

// Disable stops a person signing in and ends their access (C101). It has no
// HTTP route until authorization decides who may call it (roadmap step 8).
func (m *Module) Disable(ctx context.Context, kratosIdentityID string) error {
	return m.service.Disable(ctx, kratosIdentityID)
}
