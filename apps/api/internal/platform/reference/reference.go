// Package reference owns the platform's shared reference data (C122): so far the
// ISO 3166-1 countries (C135), legal forms, sectors, and institution types (C136, C138). Platform capabilities (identity, tenancy) and
// business modules (HRMS) reference it instead of keeping their own lists. Its
// tables are in migrations (C48, C95), its Cerbos policies in policies (C151), and
// its read routes (countries, legal forms, institution types) in routes.go.
package reference

import (
	"context"
	"embed"
	"io/fs"
	"log/slog"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/embedded"
	"github.com/boolmv/erp/apps/api/internal/platform/reference/adapters/store"
)

//go:embed migrations/*.sql
var migrations embed.FS

//go:embed all:policies
var policies embed.FS

// Migrations returns the package's tables, applied by cmd/migrate as "reference".
func Migrations() fs.FS {
	return embedded.Dir(migrations, "migrations")
}

// Policies returns the module's Cerbos policies, their tests, and their schemas
// (C151), assembled as "reference".
func Policies() fs.FS {
	return embedded.Dir(policies, "policies")
}

// Module is the reference module's read side.
type Module struct {
	db     store.Querier
	logger *slog.Logger
}

// New returns the module over db, the pool as the runtime role.
func New(db store.Querier, logger *slog.Logger) *Module {
	return &Module{db: db, logger: logger}
}

// CountryCurrent reports whether code is a country in use (tenancy.Reference).
func (m *Module) CountryCurrent(ctx context.Context, code string) (bool, error) {
	return store.CountryCurrent(ctx, m.db, code)
}

// LegalForm returns a current legal form's country and the identity document it names
// (tenancy.Reference).
func (m *Module) LegalForm(ctx context.Context, id string) (country, identityDocument string, ok bool, err error) {
	return store.CurrentLegalForm(ctx, m.db, id)
}

// InstitutionTypesCurrent returns which of codes are current institution types (tenancy.Reference).
func (m *Module) InstitutionTypesCurrent(ctx context.Context, codes []string) (map[string]bool, error) {
	return store.InstitutionTypesCurrent(ctx, m.db, codes)
}
