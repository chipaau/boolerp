// Package identity is the identity module (C94): our users, a projection of the
// accounts in Kratos, created on first use and kept current by Kratos's web hook.
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

	"github.com/go-chi/chi/v5"

	httpadapter "github.com/boolmv/erp/apps/api/internal/modules/identity/adapters/http"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/adapters/kratos"
	"github.com/boolmv/erp/apps/api/internal/modules/identity/adapters/postgres"
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
	WebhookKey     string // the web hook's shared secret
}

// Module is the identity module.
type Module struct {
	service *application.Service
	hooks   *httpadapter.Hooks
}

// New returns the module over the database (a pool or a transaction).
func New(db postgres.DB, s Settings, client *http.Client, logger *slog.Logger) *Module {
	service := application.NewService(postgres.NewUsers(db), kratos.NewAccounts(s.KratosAdminURL, client))
	return &Module{service: service, hooks: httpadapter.NewHooks(service, s.WebhookKey, logger)}
}

// Resolve returns the user for a Kratos account (a token's sub), creating it on
// first use.
func (m *Module) Resolve(ctx context.Context, kratosIdentityID string) (domain.User, error) {
	return m.service.Resolve(ctx, kratosIdentityID)
}

// InternalRoutes registers the routes served only on the internal listener: the
// Kratos web hook (POST /kratos).
func (m *Module) InternalRoutes(r chi.Router) {
	m.hooks.Routes(r)
}
