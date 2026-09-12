// Command provision-dev creates a single dev owner login for the malecouncil tenant, bypassing the
// normal invite/recovery-email onboarding flow (see auth.md) so local dev has something to sign in
// with immediately. Dev tooling only — never run against a real environment. Safe to re-run: it
// skips creation if the tenant and its owner already exist.
//
// Usage: go run ./cmd/provision-dev
// Config comes from the same env vars as cmd/api (APP_DSN, APP_KRATOS_ADMIN_URL, ...).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/config"
	"github.com/boolmv/goerp/internal/db/sqlc"
	"github.com/boolmv/goerp/internal/tenancy"
)

const (
	tenantSlug = "malecouncil"
	tenantCode = "MCC"
	tenantName = "Malé City Council"
	// user@malecouncil.test / operatorEmail below use the reserved .test TLD (RFC 2606) since
	// these logins only ever exist in this compose stack — kept in sync with the login pages'
	// DEV_CREDENTIALS (apps/app, apps/admin), which autofill exactly these values in dev builds.
	ownerEmail = "user@malecouncil.test"
	ownerName  = "Dev Owner"
	// devPassword is a throwaway local-only credential, same spirit as kratos.yml's own
	// dev-insecure secrets — never valid outside this compose stack.
	devPassword = "dev-password-12345"

	internalTenantSlug = "internal"
	internalTenantCode = "OPS"
	internalTenantName = "Bool ERP Platform Operations"
	// operatorAppCode: roles are app-scoped now (ADR revision, 2026-09-12); control-centre is the
	// one app seeded so far (00008_authorization.sql) — not a confirmed full app catalog, just
	// enough for the operator role to have somewhere to belong.
	operatorAppCode  = "control-centre"
	operatorRoleCode = "operator"
	operatorRoleName = "Operator"
	operatorEmail    = "user@bool.test"
	operatorName     = "Dev Operator"
	operatorPassword = "dev-operator-12345"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(context.Background()); err != nil {
		slog.Error("provision-dev failed", "err", err)
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	pool, err := pgxpool.New(ctx, cfg.DSN)
	if err != nil {
		return err
	}
	defer pool.Close()

	q := sqlc.New(pool)
	kratos := auth.NewKratos(cfg.KratosPublicURL, cfg.KratosAdminURL)

	if err := provisionMalecouncilOwner(ctx, q, kratos); err != nil {
		return err
	}
	return provisionInternalOperator(ctx, q, kratos)
}

func provisionMalecouncilOwner(ctx context.Context, q *sqlc.Queries, kratos *auth.Kratos) error {
	tenant, err := q.GetTenantBySlug(ctx, tenantSlug)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		tenant, err = createTenant(ctx, q)
		if err != nil {
			return err
		}
	case err != nil:
		return fmt.Errorf("get tenant: %w", err)
	default:
		if _, err := q.GetOwnerTenantUser(ctx, tenant.ID); err == nil {
			slog.Info("already provisioned, nothing to do", "tenant", tenantSlug, "email", ownerEmail)
			return nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("get owner: %w", err)
		}
	}

	kratosID, err := kratos.CreateIdentityWithPassword(ctx, ownerEmail, ownerName, devPassword)
	if err != nil {
		return fmt.Errorf("create kratos identity: %w", err)
	}

	userID, err := auth.ParseUUID(kratosID)
	if err != nil {
		return err
	}

	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{
		ID:    userID,
		Email: ownerEmail,
		Name:  ownerName,
	}); err != nil {
		return fmt.Errorf("create user: %w", err)
	}

	if _, err := q.CreateOwnerTenantUser(ctx, sqlc.CreateOwnerTenantUserParams{
		UserID:   userID,
		TenantID: tenant.ID,
	}); err != nil {
		return fmt.Errorf("create membership: %w", err)
	}

	slog.Info("provisioned dev owner",
		"tenant", tenantSlug,
		"url", "http://"+tenantSlug+".bool.test",
		"email", ownerEmail,
		"password", devPassword,
	)
	return nil
}

func createTenant(ctx context.Context, q *sqlc.Queries) (sqlc.Tenant, error) {
	partyTypeID, err := q.GetPartyTypeIDByCode(ctx, "government")
	if err != nil {
		return sqlc.Tenant{}, fmt.Errorf("get party type: %w", err)
	}
	institutionTypeID, err := q.GetInstitutionTypeIDByCode(ctx, sqlc.GetInstitutionTypeIDByCodeParams{
		CountryCode: pgtype.Text{String: "MV", Valid: true},
		Code:        "council",
	})
	if err != nil {
		return sqlc.Tenant{}, fmt.Errorf("get institution type: %w", err)
	}

	return tenancy.CreateTenantRow(ctx, q, sqlc.CreateTenantParams{
		Slug:              tenantSlug,
		Code:              tenantCode,
		Name:              tenantName,
		PartyTypeID:       partyTypeID,
		InstitutionTypeID: institutionTypeID,
		Country:           "MV",
		Status:            "active",
		IsInternal:        false,
	})
}

// provisionInternalOperator creates the ONE internal/operator tenant (FR-AUTHZ-04), a seed
// 'operator' role holding platform:* (bootstrap default — a real template catalog is UC-AUTHZ-08),
// and one operator owner so admin.bool.test has a real, DB-backed login. This provisions the
// identity only — actual operator-only enforcement (Cerbos is_internal_member + the real principal
// in Chi middleware) is separate follow-up work; apps/admin today only checks for ANY valid session.
func provisionInternalOperator(ctx context.Context, q *sqlc.Queries, kratos *auth.Kratos) error {
	tenant, err := q.GetInternalTenant(ctx)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		tenant, err = tenancy.CreateTenantRow(ctx, q, sqlc.CreateTenantParams{
			Slug:       internalTenantSlug,
			Code:       internalTenantCode,
			Name:       internalTenantName,
			Country:    "MV",
			Status:     "active",
			IsInternal: true,
		})
		if err != nil {
			return fmt.Errorf("create internal tenant: %w", err)
		}
	case err != nil:
		return fmt.Errorf("get internal tenant: %w", err)
	}

	app, err := q.GetAppByCode(ctx, operatorAppCode)
	if err != nil {
		return fmt.Errorf("get operator app: %w", err)
	}

	role, err := q.GetRoleByAppTenantCode(ctx, sqlc.GetRoleByAppTenantCodeParams{AppID: app.ID, TenantID: tenant.ID, Code: operatorRoleCode})
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		role, err = q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenant.ID, Code: operatorRoleCode, Name: operatorRoleName})
		if err != nil {
			return fmt.Errorf("create operator role: %w", err)
		}
		if _, err := q.CreateRoleCapability(ctx, sqlc.CreateRoleCapabilityParams{RoleID: role.ID, Capability: auth.CapPlatformAll}); err != nil {
			return fmt.Errorf("grant operator role capability: %w", err)
		}
	case err != nil:
		return fmt.Errorf("get operator role: %w", err)
	}

	if _, err := q.GetOwnerTenantUser(ctx, tenant.ID); err == nil {
		slog.Info("internal operator already provisioned, nothing to do", "email", operatorEmail)
		return nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("get operator owner: %w", err)
	}

	kratosID, err := kratos.CreateIdentityWithPassword(ctx, operatorEmail, operatorName, operatorPassword)
	if err != nil {
		return fmt.Errorf("create operator kratos identity: %w", err)
	}
	userID, err := auth.ParseUUID(kratosID)
	if err != nil {
		return err
	}
	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{ID: userID, Email: operatorEmail, Name: operatorName}); err != nil {
		return fmt.Errorf("create operator user: %w", err)
	}
	if _, err := q.CreateOwnerTenantUser(ctx, sqlc.CreateOwnerTenantUserParams{UserID: userID, TenantID: tenant.ID}); err != nil {
		return fmt.Errorf("create operator membership: %w", err)
	}
	if _, err := q.CreateUserRole(ctx, sqlc.CreateUserRoleParams{
		TenantID: tenant.ID,
		UserID:   userID,
		RoleID:   role.ID,
	}); err != nil {
		return fmt.Errorf("assign operator role: %w", err)
	}

	slog.Info("provisioned dev operator",
		"tenant", internalTenantSlug,
		"url", "http://admin.bool.test",
		"email", operatorEmail,
		"password", operatorPassword,
	)
	return nil
}
