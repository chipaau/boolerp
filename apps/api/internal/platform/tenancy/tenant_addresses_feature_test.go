//go:build feature

package tenancy_test

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// addPlaces adds XT's address levels, region (1) and town (2), the region North, and a
// second country XS with its own region South; it returns North's and South's ids.
func (w *world) addPlaces(t *testing.T) (north, south string) {
	t.Helper()
	testdb.Exec(t, w.tx, `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XS', 'XSS', 'Southland', '+988')`)
	testdb.Exec(t, w.tx, `INSERT INTO geography_types (country, code, name, level)
		VALUES ('XT', 'region', 'Region', 1), ('XT', 'town', 'Town', 2), ('XS', 'region', 'Region', 1)`)
	require.NoError(t, w.tx.QueryRow(t.Context(), `INSERT INTO geographies (country, type_id, name)
		SELECT 'XT', id, 'North' FROM geography_types WHERE country = 'XT' AND code = 'region' RETURNING id`).Scan(&north))
	require.NoError(t, w.tx.QueryRow(t.Context(), `INSERT INTO geographies (country, type_id, name)
		SELECT 'XS', id, 'South' FROM geography_types WHERE country = 'XS' AND code = 'region' RETURNING id`).Scan(&south))
	return north, south
}

func TestFeatureATenantHasARegisteredAndAMailingAddress(t *testing.T) {
	w := newWorld(t)
	north, _ := w.addPlaces(t)
	a := w.tenant(t, "x-a", "XTA")
	testdb.Exec(t, w.tx, `INSERT INTO tenant_addresses (tenant_id, kind, country, geography_id, typed_places, line1, line2,
		postal_code, latitude, longitude)
		VALUES ($1, 'registered', 'XT', $2, '{"town": "Harbour"}', 'H. Sosun Villa, Sosun Magu', '3rd floor', '20026', 4.175, 73.509)`,
		a, north)
	testdb.Exec(t, w.tx, `INSERT INTO tenant_addresses (tenant_id, kind, country, line1) VALUES ($1, 'mailing', 'XT', 'PO Box 7')`, a)

	var town, at string
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT typed_places->>'town', latitude || ',' || longitude
		FROM tenant_addresses WHERE tenant_id = $1 AND kind = 'registered'`, a).Scan(&town, &at))
	assert.Equal(t, []string{"Harbour", "4.175000,73.509000"}, []string{town, at})
	var places string
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT typed_places::text FROM tenant_addresses
		WHERE tenant_id = $1 AND kind = 'mailing'`, a).Scan(&places))
	assert.Equal(t, "{}", places, "nothing typed by default")
}

func TestFeatureTenantAddressConstraints(t *testing.T) {
	const insert = `INSERT INTO tenant_addresses (tenant_id, kind, country, geography_id, typed_places, line1, line2,
		postal_code, latitude, longitude) VALUES `
	for name, c := range map[string]struct{ sql, want string }{
		"a second registered address": {`INSERT INTO tenant_addresses (tenant_id, kind, country, line1)
			VALUES ('%A%', 'registered', 'XT', 'Again')`, "23505"},
		"an unknown kind":    {insert + `('%A%', 'billing', 'XT', NULL, '{}', 'Line', NULL, NULL, NULL, NULL)`, "23514"},
		"an unknown country": {insert + `('%A%', 'mailing', 'XQ', NULL, '{}', 'Line', NULL, NULL, NULL, NULL)`, "23503"},
		"a place in another country": {insert + `('%A%', 'mailing', 'XT', '%S%', '{}', 'Line', NULL, NULL, NULL, NULL)`,
			"23503"},
		"an unknown tenant": {insert + `('0192f6a0-0000-7000-8000-000000000000', 'mailing', 'XT', NULL, '{}', 'Line',
			NULL, NULL, NULL, NULL)`, "23503"},
		"no line1":         {insert + `('%A%', 'mailing', 'XT', NULL, '{}', NULL, NULL, NULL, NULL, NULL)`, "23502"},
		"a blank line1":    {insert + `('%A%', 'mailing', 'XT', NULL, '{}', ' ', NULL, NULL, NULL, NULL)`, "23514"},
		"a blank line2":    {insert + `('%A%', 'mailing', 'XT', NULL, '{}', 'Line', ' ', NULL, NULL, NULL)`, "23514"},
		"a blank postcode": {insert + `('%A%', 'mailing', 'XT', NULL, '{}', 'Line', NULL, ' ', NULL, NULL)`, "23514"},
		"typed places not an object": {insert + `('%A%', 'mailing', 'XT', NULL, '["Harbour"]', 'Line', NULL, NULL, NULL,
			NULL)`, "23514"},
		"a typed place under a bad code": {insert + `('%A%', 'mailing', 'XT', NULL, '{"Town": "Harbour"}', 'Line', NULL,
			NULL, NULL, NULL)`, "23514"},
		"a blank typed place": {insert + `('%A%', 'mailing', 'XT', NULL, '{"town": " "}', 'Line', NULL, NULL, NULL, NULL)`,
			"23514"},
		"no typed places at all": {insert + `('%A%', 'mailing', 'XT', NULL, NULL, 'Line', NULL, NULL, NULL, NULL)`, "23502"},
		"a latitude alone":       {insert + `('%A%', 'mailing', 'XT', NULL, '{}', 'Line', NULL, NULL, 4.2, NULL)`, "23514"},
		"a latitude past 90":     {insert + `('%A%', 'mailing', 'XT', NULL, '{}', 'Line', NULL, NULL, 90.5, 73)`, "23514"},
		"a longitude past 180":   {insert + `('%A%', 'mailing', 'XT', NULL, '{}', 'Line', NULL, NULL, 4.2, 180.5)`, "23514"},
		"deleting its place":     {`DELETE FROM geographies WHERE id = '%N%'`, "23001"},
	} {
		t.Run(name, func(t *testing.T) {
			w := newWorld(t)
			north, south := w.addPlaces(t)
			a := w.tenant(t, "x-a", "XTA")
			testdb.Exec(t, w.tx, `INSERT INTO tenant_addresses (tenant_id, kind, country, geography_id, line1)
				VALUES ($1, 'registered', 'XT', $2, 'Line')`, a, north)
			sql := strings.NewReplacer("%A%", a, "%S%", south, "%N%", north).Replace(c.sql)
			_, err := testdb.Savepoint(t, w.tx, sql)
			assert.Equal(t, c.want, testdb.PgCode(err))
		})
	}
}

func TestFeatureTenantAddressPolicies(t *testing.T) {
	w := newWorld(t)
	op := w.operator(t)
	a := w.tenant(t, "x-a", "XTA")
	b := w.tenant(t, "x-b", "XTB")
	testdb.Exec(t, w.tx, `INSERT INTO tenant_addresses (tenant_id, kind, country, line1)
		VALUES ($1, 'registered', 'XT', 'A street'), ($2, 'registered', 'XT', 'B street')`, a, b)
	// Only this package uses the table, so forcing row-level security on the owner is safe here.
	w.enforce(t)
	testdb.Exec(t, w.tx, `ALTER TABLE tenant_addresses FORCE ROW LEVEL SECURITY`)

	count := func() (n int) {
		require.NoError(t, w.tx.QueryRow(t.Context(),
			`SELECT count(*) FROM tenant_addresses WHERE country = 'XT'`).Scan(&n))
		return n
	}
	w.as(t, "")
	assert.Zero(t, count(), "no tenant set: no rows")
	w.as(t, a)
	assert.Equal(t, 1, count(), "a tenant reads its own address")
	_, err := testdb.Savepoint(t, w.tx, `INSERT INTO tenant_addresses (tenant_id, kind, country, line1)
		VALUES ($1, 'mailing', 'XT', 'PO Box 1')`, a)
	assert.Equal(t, "42501", testdb.PgCode(err), "a tenant cannot add its own addresses")
	tag, err := testdb.Savepoint(t, w.tx, `UPDATE tenant_addresses SET line1 = 'Moved' WHERE tenant_id = $1`, a)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor change them")

	w.as(t, op)
	assert.Equal(t, 2, count(), "the operator reads every tenant's addresses")
	_, err = testdb.Savepoint(t, w.tx, `INSERT INTO tenant_addresses (tenant_id, kind, country, line1)
		VALUES ($1, 'mailing', 'XT', 'PO Box 1')`, a)
	require.NoError(t, err, "the operator adds them")
	tag, err = testdb.Savepoint(t, w.tx, `DELETE FROM tenant_addresses WHERE tenant_id = $1 AND kind = 'mailing'`, a)
	require.NoError(t, err)
	assert.EqualValues(t, 1, tag.RowsAffected(), "and removes a mailing address (mail goes to the registered one)")
}

// is_typed_places is the one shape check of a typed_places column: an object of type
// codes to non-blank text.
func TestFeatureIsTypedPlacesAcceptsTypeCodesToText(t *testing.T) {
	tx := testdb.Tx(t)
	for value, want := range map[string]bool{
		`{}`:                    true,
		`{"city": "San Diego"}`: true,
		`{"district": "Chennai", "city": "Chennai"}`: true,
		`[]`:            false,
		`{"City": "x"}`: false,
		`{"c": "x"}`:    false,
		`{"city": ""}`:  false,
		`{"city": 1}`:   false,
	} {
		var got bool
		require.NoError(t, tx.QueryRow(t.Context(), `SELECT is_typed_places($1::jsonb)`, value).Scan(&got), value)
		assert.Equal(t, want, got, value)
	}
}
