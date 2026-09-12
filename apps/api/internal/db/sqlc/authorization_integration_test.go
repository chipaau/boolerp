//go:build integration

package sqlc_test

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/boolmv/goerp/internal/db/sqlc"
)

// newTestUUID mints a random v4 UUID for fixtures that don't come from Kratos/provisioning.
func newTestUUID(t *testing.T) pgtype.UUID {
	t.Helper()
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("rand: %v", err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return pgtype.UUID{Bytes: b, Valid: true}
}

func createTestUser(t *testing.T, ctx context.Context, q *sqlc.Queries, email string) pgtype.UUID {
	t.Helper()
	id := newTestUUID(t)
	if _, err := q.CreateUser(ctx, sqlc.CreateUserParams{ID: id, Email: email, Name: "Test User"}); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}
	return id
}

func createTestTenant(t *testing.T, ctx context.Context, q *sqlc.Queries) pgtype.UUID {
	t.Helper()
	treeKey, err := q.NextTenantTreeKey(ctx)
	if err != nil {
		t.Fatalf("NextTenantTreeKey: %v", err)
	}
	tenant, err := q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Slug:    fmt.Sprintf("test-tenant-%d", treeKey),
		Code:    fmt.Sprintf("TT%d", treeKey),
		Name:    "Test Tenant",
		TreeKey: treeKey,
		Column7: fmt.Sprintf("%d", treeKey),
		Country: "MV",
		Status:  "active",
	})
	if err != nil {
		t.Fatalf("CreateTenant: %v", err)
	}
	return tenant.ID
}

func pgErrorCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

const (
	pgUniqueViolation = "23505"
	pgCheckViolation  = "23514"
)

// expectViolation runs fn (expected to fail with a Postgres error carrying wantCode) inside a
// SAVEPOINT and rolls back to it afterwards. A constraint violation aborts the whole surrounding
// transaction — without the savepoint, every later statement in tx would fail with
// "current transaction is aborted" (25P02) instead of running, even though the earlier,
// still-uncommitted fixture rows are exactly what the rest of the test needs.
func expectViolation(t *testing.T, ctx context.Context, tx pgx.Tx, wantCode string, fn func() error) {
	t.Helper()
	if _, err := tx.Exec(ctx, "SAVEPOINT expect_violation"); err != nil {
		t.Fatalf("savepoint: %v", err)
	}
	if got := pgErrorCode(fn()); got != wantCode {
		t.Fatalf("want pg error %s, got %q", wantCode, got)
	}
	if _, err := tx.Exec(ctx, "ROLLBACK TO SAVEPOINT expect_violation"); err != nil {
		t.Fatalf("rollback to savepoint: %v", err)
	}
}

// GetRoleByAppTenantCode must be able to find a GLOBAL role template (tenant_id IS NULL in the
// row) when called with a zero-value (NULL) tenant_id argument — `tenant_id = NULL` is always
// UNKNOWN in SQL, never TRUE, so this only works if the query uses IS NOT DISTINCT FROM.
func TestGetRoleByAppTenantCode_GlobalTemplate(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}

	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, Code: "test-global-owner", Name: "Test Global Owner"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	if role.TenantID.Valid {
		t.Fatalf("want NULL tenant_id for a global template, got %v", role.TenantID)
	}

	got, err := q.GetRoleByAppTenantCode(ctx, sqlc.GetRoleByAppTenantCodeParams{AppID: app.ID, Code: "test-global-owner"})
	if err != nil {
		t.Fatalf("GetRoleByAppTenantCode(global template): %v", err)
	}
	if got.ID != role.ID {
		t.Fatalf("want role %v, got %v", role.ID, got.ID)
	}
}

// uq_roles_app_tenant_code (NULLS NOT DISTINCT): one code per (app, tenant) — including the
// "tenant" of NULL (global templates) — but the SAME code is free to repeat across different
// tenants' own custom roles.
func TestRoles_UniqueAppTenantCode(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}

	if _, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, Code: "dup-code", Name: "First"}); err != nil {
		t.Fatalf("first global role: %v", err)
	}
	expectViolation(t, ctx, tx, pgUniqueViolation, func() error {
		_, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, Code: "dup-code", Name: "Second"})
		return err
	})

	tenantA := createTestTenant(t, ctx, q)
	tenantB := createTestTenant(t, ctx, q)
	if _, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenantA, Code: "owner", Name: "Owner"}); err != nil {
		t.Fatalf("tenantA custom role: %v", err)
	}
	if _, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenantB, Code: "owner", Name: "Owner"}); err != nil {
		t.Fatalf("tenantB custom role with the same code as tenantA: %v", err)
	}
	expectViolation(t, ctx, tx, pgUniqueViolation, func() error {
		_, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenantA, Code: "owner", Name: "Owner again"})
		return err
	})
}

// uq_roles_one_default_per_app: at most one global (tenant_id IS NULL) default role per app. A
// tenant's own custom role can carry is_default without hitting this guard — the partial index
// only covers global templates.
func TestRoles_OneDefaultPerApp(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}

	insertDefault := func(code string) error {
		_, err := tx.Exec(ctx, `INSERT INTO roles (app_id, code, name, is_default) VALUES ($1, $2, $3, true)`, app.ID, code, "Default "+code)
		return err
	}
	if err := insertDefault("default-a"); err != nil {
		t.Fatalf("first global default role: %v", err)
	}
	expectViolation(t, ctx, tx, pgUniqueViolation, func() error { return insertDefault("default-b") })

	tenant := createTestTenant(t, ctx, q)
	if _, err := tx.Exec(ctx,
		`INSERT INTO roles (app_id, tenant_id, code, name, is_default) VALUES ($1, $2, $3, $4, true)`,
		app.ID, tenant, "tenant-default", "Tenant Default",
	); err != nil {
		t.Fatalf("tenant-scoped default role alongside the global default: %v", err)
	}
}

func TestCreateRoleCapability(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, Code: "cap-test", Name: "Cap Test"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}

	created, err := q.CreateRoleCapability(ctx, sqlc.CreateRoleCapabilityParams{RoleID: role.ID, Capability: "platform:*"})
	if err != nil {
		t.Fatalf("CreateRoleCapability: %v", err)
	}
	if created.Capability != "platform:*" {
		t.Fatalf("want capability platform:*, got %q", created.Capability)
	}

	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM role_capabilities WHERE role_id = $1`, role.ID).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("want 1 capability row, got %d", count)
	}
}

// uq_user_roles_current: one CURRENT (active_to IS NULL) grant per (tenant, user, role) — but a
// past, ended grant doesn't block re-granting the same role later.
func TestUserRoles_OneCurrentGrantPerTenantUserRole(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	tenant := createTestTenant(t, ctx, q)
	user := createTestUser(t, ctx, q, "grantee@example.test")
	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenant, Code: "member", Name: "Member"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}

	first, err := q.CreateUserRole(ctx, sqlc.CreateUserRoleParams{TenantID: tenant, UserID: user, RoleID: role.ID})
	if err != nil {
		t.Fatalf("first CreateUserRole: %v", err)
	}

	expectViolation(t, ctx, tx, pgUniqueViolation, func() error {
		_, err := q.CreateUserRole(ctx, sqlc.CreateUserRoleParams{TenantID: tenant, UserID: user, RoleID: role.ID})
		return err
	})

	if _, err := tx.Exec(ctx, `UPDATE user_roles SET active_to = now() WHERE id = $1`, first.ID); err != nil {
		t.Fatalf("end the first grant: %v", err)
	}
	if _, err := q.CreateUserRole(ctx, sqlc.CreateUserRoleParams{TenantID: tenant, UserID: user, RoleID: role.ID}); err != nil {
		t.Fatalf("re-grant after the first ended: %v", err)
	}
}

func TestUserRoles_ActiveOrderCheck(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	tenant := createTestTenant(t, ctx, q)
	user := createTestUser(t, ctx, q, "backdated@example.test")
	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenant, Code: "member", Name: "Member"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO user_roles (tenant_id, user_id, role_id, active_from, active_to) VALUES ($1, $2, $3, now(), now() - interval '1 day')`,
		tenant, user, role.ID,
	)
	if pgErrorCode(err) != pgCheckViolation {
		t.Fatalf("want check_violation for active_to before active_from, got %v", err)
	}
}

// role_requests' three CHECK constraints enforce the four-eyes rule: the requester can be neither
// the reviewer nor the approver, and the reviewer/approver stages can't be the same person.
func TestRoleRequests_FourEyesDistinctness(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	tenant := createTestTenant(t, ctx, q)
	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenant, Code: "member", Name: "Member"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	requester := createTestUser(t, ctx, q, "requester@example.test")
	target := createTestUser(t, ctx, q, "target@example.test")

	insert := func(reviewedBy, approvedBy pgtype.UUID) error {
		_, err := tx.Exec(ctx,
			`INSERT INTO role_requests (tenant_id, target_user_id, role_id, requested_by, reason, reviewed_by, approved_by)
			 VALUES ($1, $2, $3, $4, 'test', $5, $6)`,
			tenant, target, role.ID, requester, reviewedBy, approvedBy,
		)
		return err
	}

	expectViolation(t, ctx, tx, pgCheckViolation, func() error { return insert(requester, pgtype.UUID{}) })
	expectViolation(t, ctx, tx, pgCheckViolation, func() error { return insert(pgtype.UUID{}, requester) })
	reviewer := createTestUser(t, ctx, q, "reviewer@example.test")
	expectViolation(t, ctx, tx, pgCheckViolation, func() error { return insert(reviewer, reviewer) })
	approver := createTestUser(t, ctx, q, "approver@example.test")
	if err := insert(reviewer, approver); err != nil {
		t.Fatalf("distinct requester/reviewer/approver should be allowed: %v", err)
	}
}

func TestRoleRequests_StatusCheck(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	tenant := createTestTenant(t, ctx, q)
	role, err := q.CreateRole(ctx, sqlc.CreateRoleParams{AppID: app.ID, TenantID: tenant, Code: "member", Name: "Member"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	requester := createTestUser(t, ctx, q, "requester-status@example.test")
	target := createTestUser(t, ctx, q, "target-status@example.test")

	_, err = tx.Exec(ctx,
		`INSERT INTO role_requests (tenant_id, target_user_id, role_id, requested_by, reason, status) VALUES ($1,$2,$3,$4,'test','bogus-status')`,
		tenant, target, role.ID, requester,
	)
	if pgErrorCode(err) != pgCheckViolation {
		t.Fatalf("want check_violation for an invalid status, got %v", err)
	}
}

// support_access_grants mirrors role_requests' four-eyes shape (proposed/reviewed/approved).
func TestSupportAccessGrants_FourEyesDistinctness(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	tenant := createTestTenant(t, ctx, q)
	target := createTestUser(t, ctx, q, "target-sag@example.test")
	proposer := createTestUser(t, ctx, q, "proposer-sag@example.test")

	insert := func(reviewedBy, approvedBy pgtype.UUID) error {
		_, err := tx.Exec(ctx,
			`INSERT INTO support_access_grants (tenant_id, target_user_id, reason, proposed_by, reviewed_by, approved_by)
			 VALUES ($1, $2, 'test', $3, $4, $5)`,
			tenant, target, proposer, reviewedBy, approvedBy,
		)
		return err
	}

	expectViolation(t, ctx, tx, pgCheckViolation, func() error { return insert(proposer, pgtype.UUID{}) })
	expectViolation(t, ctx, tx, pgCheckViolation, func() error { return insert(pgtype.UUID{}, proposer) })
	reviewer := createTestUser(t, ctx, q, "reviewer-sag@example.test")
	expectViolation(t, ctx, tx, pgCheckViolation, func() error { return insert(reviewer, reviewer) })
	approver := createTestUser(t, ctx, q, "approver-sag@example.test")
	if err := insert(reviewer, approver); err != nil {
		t.Fatalf("distinct proposer/reviewer/approver should be allowed: %v", err)
	}
}

func TestSupportAccessGrants_StatusCheck(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	tenant := createTestTenant(t, ctx, q)
	target := createTestUser(t, ctx, q, "target-sag-status@example.test")
	proposer := createTestUser(t, ctx, q, "proposer-sag-status@example.test")

	_, err := tx.Exec(ctx,
		`INSERT INTO support_access_grants (tenant_id, target_user_id, reason, proposed_by, status) VALUES ($1,$2,'test',$3,'bogus-status')`,
		tenant, target, proposer,
	)
	if pgErrorCode(err) != pgCheckViolation {
		t.Fatalf("want check_violation for an invalid status, got %v", err)
	}
}

// uq_tenant_apps_current: one CURRENT (active_to IS NULL) activation per (tenant, app); a past
// deactivation doesn't block re-activating later.
func TestTenantApps_OneCurrentActivationPerTenantApp(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	tenant := createTestTenant(t, ctx, q)

	var firstID pgtype.UUID
	if err := tx.QueryRow(ctx, `INSERT INTO tenant_apps (tenant_id, app_id) VALUES ($1, $2) RETURNING id`, tenant, app.ID).Scan(&firstID); err != nil {
		t.Fatalf("first activation: %v", err)
	}

	expectViolation(t, ctx, tx, pgUniqueViolation, func() error {
		_, err := tx.Exec(ctx, `INSERT INTO tenant_apps (tenant_id, app_id) VALUES ($1, $2)`, tenant, app.ID)
		return err
	})

	if _, err := tx.Exec(ctx, `UPDATE tenant_apps SET active_to = now() WHERE id = $1`, firstID); err != nil {
		t.Fatalf("deactivate: %v", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO tenant_apps (tenant_id, app_id) VALUES ($1, $2)`, tenant, app.ID); err != nil {
		t.Fatalf("re-activate after deactivation: %v", err)
	}
}

// uq_tenant_settings_scope (NULLS NOT DISTINCT): one row per (tenant, app_id, key) — including
// app_id NULL (tenant-wide) — and a tenant-wide row doesn't conflict with an app-scoped one for
// the same key.
func TestTenantSettings_UniqueScope(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	tenant := createTestTenant(t, ctx, q)

	if _, err := tx.Exec(ctx, `INSERT INTO tenant_settings (tenant_id, key, value) VALUES ($1, 'requires_role_approval', 'true')`, tenant); err != nil {
		t.Fatalf("tenant-wide setting: %v", err)
	}
	expectViolation(t, ctx, tx, pgUniqueViolation, func() error {
		_, err := tx.Exec(ctx, `INSERT INTO tenant_settings (tenant_id, key, value) VALUES ($1, 'requires_role_approval', 'false')`, tenant)
		return err
	})

	if _, err := tx.Exec(ctx,
		`INSERT INTO tenant_settings (tenant_id, app_id, key, value) VALUES ($1, $2, 'requires_role_approval', 'true')`,
		tenant, app.ID,
	); err != nil {
		t.Fatalf("app-scoped setting alongside the tenant-wide one: %v", err)
	}
	expectViolation(t, ctx, tx, pgUniqueViolation, func() error {
		_, err := tx.Exec(ctx,
			`INSERT INTO tenant_settings (tenant_id, app_id, key, value) VALUES ($1, $2, 'requires_role_approval', 'false')`,
			tenant, app.ID,
		)
		return err
	})
}

// uq_user_apps_current: one CURRENT (active_to IS NULL) subscription per (tenant, user, app); a
// past unsubscription doesn't block re-subscribing later.
func TestUserApps_OneCurrentSubscriptionPerTenantUserApp(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)
	q := sqlc.New(tx)

	app, err := q.GetAppByCode(ctx, "control-centre")
	if err != nil {
		t.Fatalf("GetAppByCode: %v", err)
	}
	tenant := createTestTenant(t, ctx, q)
	user := createTestUser(t, ctx, q, "subscriber@example.test")

	var firstID pgtype.UUID
	if err := tx.QueryRow(ctx,
		`INSERT INTO user_apps (tenant_id, user_id, app_id) VALUES ($1, $2, $3) RETURNING id`,
		tenant, user, app.ID,
	).Scan(&firstID); err != nil {
		t.Fatalf("first subscription: %v", err)
	}

	expectViolation(t, ctx, tx, pgUniqueViolation, func() error {
		_, err := tx.Exec(ctx, `INSERT INTO user_apps (tenant_id, user_id, app_id) VALUES ($1, $2, $3)`, tenant, user, app.ID)
		return err
	})

	if _, err := tx.Exec(ctx, `UPDATE user_apps SET active_to = now() WHERE id = $1`, firstID); err != nil {
		t.Fatalf("unsubscribe: %v", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO user_apps (tenant_id, user_id, app_id) VALUES ($1, $2, $3)`, tenant, user, app.ID); err != nil {
		t.Fatalf("re-subscribe after unsubscribing: %v", err)
	}
}

func TestApps_ActiveOrderCheck(t *testing.T) {
	ctx := context.Background()
	tx := env.Tx(t)

	_, err := tx.Exec(ctx, `INSERT INTO apps (code, name, active_from, active_to) VALUES ('bogus-app', 'Bogus', now(), now() - interval '1 day')`)
	if pgErrorCode(err) != pgCheckViolation {
		t.Fatalf("want check_violation for active_to before active_from, got %v", err)
	}
}
