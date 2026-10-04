//go:build feature

package tenancy_test

import (
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
)

// The operator seeder's tests live here, not in the seeds package: only one
// operator can exist, so tests in two packages creating one at the same time
// would wait on each other.

// testOperator is an operator built from the test world's rows.
var testOperator = seeds.Tenant{
	Slug: "x-operator", Code: "XOP", Name: "Test operator", Country: "XT",
	LegalForm: "test_company", IdentityNumber: "T-1", RegisteredOn: "2026-01-01",
	Timezone: "Indian/Maldives", Email: "ops@example.test", Phone: "+9990000001",
	PrimaryType: "x_tenancy_type",
}

func seedEnv() seed.Env { return seedEnvFor("test") }

func seedEnvFor(environment string) seed.Env {
	return seed.NewEnv(environment, slog.New(slog.DiscardHandler))
}

func TestFeatureTheOperatorSeederCreatesAnActiveOperator(t *testing.T) {
	w := newWorld(t)
	s := seeds.NewOperator(w.tx, testOperator)
	assert.Equal(t, "tenancy.operator", s.Name())
	require.NoError(t, s.Run(t.Context(), seedEnv()))
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`) // an active tenant has its primary type

	var slug, status, primary, form string
	var isOperator bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `
		SELECT t.slug, t.status, t.is_operator, it.institution_type, lf.code
		  FROM tenants t
		  JOIN tenant_institution_types it ON it.tenant_id = t.id AND it.is_primary
		  JOIN legal_forms lf ON lf.id = t.legal_form_id
		 WHERE t.is_operator`).Scan(&slug, &status, &isOperator, &primary, &form))
	assert.Equal(t, "x-operator", slug)
	assert.Equal(t, "active", status)
	assert.True(t, isOperator)
	assert.Equal(t, "x_tenancy_type", primary)
	assert.Equal(t, "test_company", form)
}

func TestFeatureTheOperatorSeederLeavesAnExistingOperator(t *testing.T) {
	w := newWorld(t)
	s := seeds.NewOperator(w.tx, testOperator)
	require.NoError(t, s.Run(t.Context(), seedEnv()))
	exec(t, w.tx, `UPDATE tenants SET name = 'Renamed in the admin console' WHERE is_operator`)
	require.NoError(t, s.Run(t.Context(), seedEnv()))

	var name string
	var operators int
	require.NoError(t, w.tx.QueryRow(t.Context(),
		`SELECT max(name), count(*) FROM tenants WHERE is_operator`).Scan(&name, &operators))
	assert.Equal(t, 1, operators)
	assert.Equal(t, "Renamed in the admin console", name, "later changes stay")
}

func TestFeatureTheOperatorSeederNeedsItsLegalForm(t *testing.T) {
	w := newWorld(t)
	missing := testOperator
	missing.LegalForm = "x_none"
	require.Error(t, seeds.NewOperator(w.tx, missing).Run(t.Context(), seedEnv()))
}

func TestBoolIsAValidOperator(t *testing.T) {
	assert.Equal(t, "workspace", seeds.Bool.Slug)
	assert.Equal(t, "BOOL", seeds.Bool.Code)
	assert.Regexp(t, `^\+[0-9]{6,15}$`, seeds.Bool.Phone)
}
