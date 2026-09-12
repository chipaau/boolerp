package tenancy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/audit"
	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
)

// CreateTenantRow computes the next tree_key and inserts a root tenant row — the piece shared by
// every provisioning path regardless of how the owner identity gets created (dev fixed-password
// tooling vs. the real recovery-link flow below).
func CreateTenantRow(ctx context.Context, q *sqlc.Queries, p sqlc.CreateTenantParams) (sqlc.Tenant, error) {
	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		return sqlc.Tenant{}, fmt.Errorf("tenancy: next tree key: %w", err)
	}
	p.TreeKey = treeKey
	p.Column7 = fmt.Sprintf("%d", treeKey)
	tenant, err := q.CreateTenant(ctx, p)
	if err != nil {
		return sqlc.Tenant{}, fmt.Errorf("tenancy: create tenant: %w", err)
	}
	return tenant, nil
}

// ProvisionParams is everything FR-TEN-01's engine needs: create tenant -> owner identity -> owner
// membership -> a recovery link the operator hands the new owner. No party/institution type is
// hardcoded here (unlike cmd/provision-dev's single dev-fixture tenant) — the caller (operator UI)
// supplies the tenant's actual classification.
type ProvisionParams struct {
	Slug              string
	Code              string
	Name              string
	PartyTypeID       pgtype.UUID
	InstitutionTypeID pgtype.UUID
	Country           string
	OwnerEmail        string
	OwnerName         string
	// ActorUserID is who is provisioning this tenant (the operator), for the audit trail — the zero
	// value (system-initiated: first-run setup, self-serve onboarding) records no actor.
	ActorUserID pgtype.UUID
}

// ProvisionResult is the newly created tenant plus the recovery link for its owner.
type ProvisionResult struct {
	Tenant       sqlc.Tenant
	RecoveryLink string
}

// Provision is FR-TEN-01's engine: create tenant -> owner identity (Kratos, no password) -> owner
// membership -> recovery link, atomically. A failure after the Kratos identity was created but
// before the DB work commits deletes that identity again (best-effort) so a failed attempt never
// squats a slug or leaves an orphaned Kratos identity — one caller today (the future admin "create
// tenant" handler), triggerable later from onboarding (08) and first-run (01) per FR-TEN-02.
//
// Known simplification vs. the full SRS lifecycle: this creates the tenant directly as `active`
// rather than `provisioning` -> `active` on owner activation, since no callback from "owner set
// their credential" exists yet to drive that transition. Revisit once UC-MEM-03 is wired to it.
//
// Default role-template seeding (the last step FR-TEN-01 names) is deliberately not done here —
// FR-AUTHZ-08's default role templates don't exist yet; there is nothing to seed.
func Provision(ctx context.Context, pool *pgxpool.Pool, kratos *auth.Kratos, p ProvisionParams) (result ProvisionResult, err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: begin tx: %w", err)
	}
	var kratosIdentityID string
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
			if kratosIdentityID != "" {
				_ = kratos.DeleteIdentity(context.Background(), kratosIdentityID)
			}
		}
	}()

	q := sqlc.New(tx)
	tenant, err := CreateTenantRow(ctx, q, sqlc.CreateTenantParams{
		Slug: p.Slug, Code: p.Code, Name: p.Name,
		PartyTypeID: p.PartyTypeID, InstitutionTypeID: p.InstitutionTypeID,
		Country: p.Country, Status: "active", IsInternal: false,
	})
	if err != nil {
		return ProvisionResult{}, err
	}

	kratosIdentityID, err = kratos.CreateIdentity(ctx, p.OwnerEmail, p.OwnerName)
	if err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: create owner identity: %w", err)
	}

	ownerID, err := auth.ParseUUID(kratosIdentityID)
	if err != nil {
		return ProvisionResult{}, err
	}
	if _, err = q.CreateUser(ctx, sqlc.CreateUserParams{ID: ownerID, Email: p.OwnerEmail, Name: p.OwnerName}); err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: create owner user: %w", err)
	}
	if _, err = q.CreateOwnerTenantUser(ctx, sqlc.CreateOwnerTenantUserParams{UserID: ownerID, TenantID: tenant.ID}); err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: create owner membership: %w", err)
	}

	// audit_log is RLS-scoped: set the session vars Provision's own transaction hasn't needed until
	// now (it doesn't go through WithTenant's callback shape) so the row's tenant_id can resolve.
	if err = setCurrentTenant(ctx, tx, tenant.ID); err != nil {
		return ProvisionResult{}, err
	}
	auditPayload, err := json.Marshal(map[string]any{"after": map[string]string{"slug": tenant.Slug, "status": tenant.Status}})
	if err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: marshal audit payload: %w", err)
	}
	if err = audit.Record(ctx, tx, audit.Entry{
		ActorUserID: p.ActorUserID, EntityType: "tenant", EntityID: tenant.ID, Action: "create", Payload: auditPayload,
	}); err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: %w", err)
	}

	link, err := kratos.CreateRecoveryLink(ctx, kratosIdentityID)
	if err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: create recovery link: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return ProvisionResult{}, fmt.Errorf("tenancy: provision: commit: %w", err)
	}
	return ProvisionResult{Tenant: tenant, RecoveryLink: link}, nil
}
