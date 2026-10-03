//go:build feature

package tenancy_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
)

// A small list in the test world's country and types, in the sample file's format.
const testSamples = `slug,code,name,country,legal_form,identity_number,parent,types
x-ministry,XMIN,Test Ministry,XT,test_ministry,,,x_tenancy_type
x-hospital,XHOS,Test Hospital,XT,test_ministry,,x-ministry,x_tenancy_type|x_tenancy_type2
x-company,XCOM,Test Company,XT,test_company,T-9,,x_tenancy_type2
x-new,XNEW,Test New,XT,,,,
`

func TestFeatureTheSampleSeederCreatesTenantsInDev(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	s := seeds.NewSamplesFrom(w.tx, []byte(testSamples))
	assert.Equal(t, "tenancy.sample_tenants", s.Name())
	require.NoError(t, s.Run(t.Context(), seedEnvFor("dev")))
	exec(t, w.tx, `SET CONSTRAINTS ALL IMMEDIATE`) // every active sample has its primary type
	require.NoError(t, s.Run(t.Context(), seedEnvFor("dev")), "running again is fine")

	var parent, status, primary string
	var types int
	require.NoError(t, w.tx.QueryRow(t.Context(), `
		SELECT p.slug, t.status, it.institution_type,
		       (SELECT count(*) FROM tenant_institution_types a WHERE a.tenant_id = t.id)
		  FROM tenants t JOIN tenants p ON p.id = t.parent_id
		  JOIN tenant_institution_types it ON it.tenant_id = t.id AND it.is_primary
		 WHERE t.slug = 'x-hospital'`).Scan(&parent, &status, &primary, &types))
	assert.Equal(t, "x-ministry", parent)
	assert.Equal(t, "active", status)
	assert.Equal(t, "x_tenancy_type", primary, "the first type is the primary")
	assert.Equal(t, 2, types)

	var newStatus string
	var count int
	require.NoError(t, w.tx.QueryRow(t.Context(),
		`SELECT max(status) FILTER (WHERE slug = 'x-new'), count(*) FROM tenants WHERE slug LIKE 'x-%'`).Scan(&newStatus, &count))
	assert.Equal(t, "provisioning", newStatus)
	assert.Equal(t, 4, count, "running again never duplicates")
}

func TestFeatureTheSampleSeederRunsOnlyInDev(t *testing.T) {
	w := newWorld(t)
	require.NoError(t, seeds.NewSamplesFrom(w.tx, []byte(testSamples)).Run(t.Context(), seedEnvFor("staging")))
	var count int
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM tenants WHERE slug LIKE 'x-%'`).Scan(&count))
	assert.Zero(t, count)
}

func TestFeatureTheSampleSeederNeedsItsLegalForm(t *testing.T) {
	w := newWorld(t)
	bad := "slug,code,name,country,legal_form,identity_number,parent,types\nx-a,XTA,A,XT,x_none,,,x_tenancy_type\n"
	require.Error(t, seeds.NewSamplesFrom(w.tx, []byte(bad)).Run(t.Context(), seedEnvFor("dev")))
}
