//go:build feature

package tenancy_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/seeds"
)

// A small list in the test world's country and types, in the sample file's format.
const testSamples = `slug,code,name,country,legal_form,identity_number,parent,types
x-ministry,XMIN,Test Ministry,XT,test_ministry,,,x_tenancy_type
x-hospital,XHOS,Test Hospital,XT,test_ministry,,x-ministry,x_tenancy_type|x_tenancy_type2
x-company,XCOM,Test Company,XT,test_company,T-9,,x_tenancy_type2
x-new,XNEW,Test New,XT,test_company,T-10,,
`

func TestFeatureTheSampleSeederCreatesTenantsInDev(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	s := seeds.NewSamplesFrom(w.tx, []byte(testSamples), "x-tenancy.test")
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
	assert.Equal(t, 4, testdb.Count(t, w.tx, "tenants", map[string]any{"timezone": "Indian/Maldives"}),
		"every sample gets the sample time zone")

	for _, slug := range []string{"x-ministry", "x-hospital", "x-company", "x-new"} {
		testdb.AssertHas(t, w.tx, "domains", map[string]any{
			"host": slug + ".x-tenancy.test", "kind": "platform", "status": "active", "is_primary": true,
		})
		assert.Equal(t, 1, testdb.Count(t, w.tx, "domains", map[string]any{"host": slug + ".x-tenancy.test"}))
	}
}

func TestFeatureTheSampleSeederKeepsAnotherPrimary(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	a := w.tenant(t, "x-company", "XCOM")
	// A verified custom host is already the primary.
	exec(t, w.tx, `INSERT INTO domains (tenant_id, host, kind, verification_token, status, verified_at, activated_at, is_primary)
		VALUES ($1, 'own.x-tenancy.test', 'custom', $2, 'active', now(), now(), true)`, a, token)
	require.NoError(t, seeds.NewSamplesFrom(w.tx, []byte(testSamples), "x-tenancy.test").Run(t.Context(), seedEnvFor("dev")))

	testdb.AssertHas(t, w.tx, "domains", map[string]any{"host": "own.x-tenancy.test", "is_primary": true})
	testdb.AssertHas(t, w.tx, "domains", map[string]any{"host": "x-company.x-tenancy.test", "is_primary": false})
}

func TestFeatureTheSampleSeederRunsOnlyInDev(t *testing.T) {
	w := newWorld(t)
	require.NoError(t, seeds.NewSamplesFrom(w.tx, []byte(testSamples), "x-tenancy.test").Run(t.Context(), seedEnvFor("staging")))
	var count int
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM tenants WHERE slug LIKE 'x-%'`).Scan(&count))
	assert.Zero(t, count)
}

func TestFeatureTheSampleSeederNeedsItsLegalForm(t *testing.T) {
	w := newWorld(t)
	bad := "slug,code,name,country,legal_form,identity_number,parent,types\nx-a,XTA,A,XT,x_none,,,x_tenancy_type\n"
	require.Error(t, seeds.NewSamplesFrom(w.tx, []byte(bad), "x-tenancy.test").Run(t.Context(), seedEnvFor("dev")))
}

// Hosts for the sample domain tests, of the tenants in testSamples.
const testSampleDomains = `tenant,host,kind,serves,status,primary
x-company,own.x-tenancy.test,custom,workspace,active,yes
x-company,portal.x-tenancy.test,custom,academics.student,pending,no
`

func TestFeatureTheSampleDomainSeederAddsHostsInDev(t *testing.T) {
	w := newWorld(t)
	w.addTypes(t)
	require.NoError(t, seeds.NewSamplesFrom(w.tx, []byte(testSamples), "x-tenancy.test").Run(t.Context(), seedEnvFor("dev")))
	s := seeds.NewSampleDomainsFrom(w.tx, []byte(testSampleDomains))
	assert.Equal(t, "tenancy.sample_domains", s.Name())
	require.NoError(t, s.Run(t.Context(), seedEnvFor("dev")))
	require.NoError(t, s.Run(t.Context(), seedEnvFor("dev")), "running again is fine")

	testdb.AssertHas(t, w.tx, "domains", map[string]any{
		"host": "own.x-tenancy.test", "kind": "custom", "status": "active", "is_primary": true,
	})
	testdb.AssertHas(t, w.tx, "domains", map[string]any{"host": "x-company.x-tenancy.test", "is_primary": false})
	testdb.AssertHas(t, w.tx, "domains", map[string]any{
		"host": "portal.x-tenancy.test", "serves": "academics.student", "status": "pending", "is_primary": false,
	})
	assert.Equal(t, 1, testdb.Count(t, w.tx, "domains", map[string]any{"host": "own.x-tenancy.test"}))
	var verified bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT verified_at IS NOT NULL AND verification_token IS NOT NULL
		FROM domains WHERE host = 'own.x-tenancy.test'`).Scan(&verified))
	assert.True(t, verified, "an active custom host stands in for a verified one")
}

func TestFeatureTheSampleDomainSeederRunsOnlyInDev(t *testing.T) {
	w := newWorld(t)
	require.NoError(t, seeds.NewSampleDomainsFrom(w.tx, []byte(testSampleDomains)).Run(t.Context(), seedEnvFor("staging")))
	testdb.AssertMissing(t, w.tx, "domains", map[string]any{"host": "own.x-tenancy.test"})
}

func TestFeatureTheSampleDomainSeederNeedsItsTenant(t *testing.T) {
	w := newWorld(t)
	require.Error(t, seeds.NewSampleDomainsFrom(w.tx, []byte(testSampleDomains)).Run(t.Context(), seedEnvFor("dev")))
}
