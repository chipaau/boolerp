// Package seeds holds the tenancy module's seed files (C50, C135). The operator
// tenant and its platform workspace host are data every database needs:
// cmd/deploy (production) and cmd/seed (development) create them, as the
// migration role that owns the tables, the only role that can create an operator.
package seeds

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

// DB is what the seeder needs: a pool, or a transaction in tests (C79).
type DB interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Tenant is a tenant a seeder creates: its legal form by country and code, its
// primary institution type by code.
type Tenant struct {
	Slug, Code, Name, Country, LegalForm, IdentityNumber, RegisteredOn string
	Timezone, Email, Phone, PrimaryType                                string
}

// Bool is the platform's operator tenant (C115, C142), with the details
// the user gave on 2026-10-04. Its workspace is workspace.<platform domain>
// (workspace.bool.mv in production); the admin console
// (admin.bool.mv) is a separate operator-only domain, not a workspace. The
// registration number is a placeholder until Bool's real one is set (the seeder
// never overwrites an existing operator).
var Bool = Tenant{
	Slug: "workspace", Code: "BOOL", Name: "Bool", Country: "MV",
	LegalForm: "private_company", IdentityNumber: "C-1024/2026", RegisteredOn: "2026-01-01",
	Timezone: "Indian/Maldives", Email: "hello@bool.mv", Phone: "+9607800272",
	PrimaryType: "it_services",
}

// Operator creates the operator tenant, active, if there is none, and gives the
// operator its platform workspace host if it has none (C158). An existing
// operator is left as it is, so changes made later (in the admin console) stay.
type Operator struct {
	db             DB
	tenant         Tenant
	platformDomain string
}

// NewOperator returns the seeder that creates t (Bool, in the edition) over db,
// with its workspace at <slug>.<platformDomain> (C159).
func NewOperator(db DB, t Tenant, platformDomain string) *Operator {
	return &Operator{db: db, tenant: t, platformDomain: platformDomain}
}

// Name implements seed.Seeder.
func (*Operator) Name() string { return "tenancy.operator" }

// Run implements seed.Seeder. The tenant and its primary type are written in one
// transaction, so the rule that an active tenant has a primary type (checked at
// commit) holds.
func (o *Operator) Run(ctx context.Context, env seed.Env) error {
	tx, err := o.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // a no-op after Commit
	// Attributed to the seeder in the audit (C164).
	if err := actor.Apply(ctx, tx, ""); err != nil {
		return fmt.Errorf("audit context: %w", err)
	}

	var id, slug string
	err = tx.QueryRow(ctx, `SELECT id, slug FROM tenants WHERE is_operator`).Scan(&id, &slug)
	switch {
	case err == nil:
		env.Logger.InfoContext(ctx, "operator tenant exists; left as it is")
	case errors.Is(err, pgx.ErrNoRows):
		if id, err = o.create(ctx, tx); err != nil {
			return err
		}
		slug = o.tenant.Slug
		env.Logger.InfoContext(ctx, "operator tenant created")
	default:
		return fmt.Errorf("find the operator: %w", err)
	}
	added, err := ensurePlatformDomain(ctx, tx, id, slug, o.platformDomain)
	if err != nil {
		return err
	}
	if added {
		env.Logger.InfoContext(ctx, "operator workspace domain created", "host", slug+"."+o.platformDomain)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// create inserts the operator tenant and its primary type, returning its id.
func (o *Operator) create(ctx context.Context, tx pgx.Tx) (string, error) {
	t := o.tenant
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO tenants (slug, code, name, country, legal_form_id, identity_number, registered_on,
		                     timezone, email, phone, is_operator, status, activated_at)
		SELECT $1, $2, $3, $4, lf.id, $6, $7::date, $8, $9, $10, true, 'active', now()
		  FROM legal_forms lf WHERE lf.country = $4 AND lf.code = $5
		RETURNING id`,
		t.Slug, t.Code, t.Name, t.Country, t.LegalForm, t.IdentityNumber, t.RegisteredOn,
		t.Timezone, t.Email, t.Phone).Scan(&id)
	if err != nil {
		// No row back means the legal form is missing: the reference seed files run first.
		return "", fmt.Errorf("create the operator (legal form %s/%s): %w", t.Country, t.LegalForm, err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary)
		VALUES ($1, $2, true)`, id, t.PrimaryType); err != nil {
		return "", fmt.Errorf("the operator's primary type %s: %w", t.PrimaryType, err)
	}
	return id, nil
}
