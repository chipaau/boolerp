//go:build feature

package seeds

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

const (
	testGeographyTypes = `country,code,name,level
XA,region,Region,1
XA,town,Town,2
XA,ward,Ward,3
`
	testGeographies = `country,type,parent,code,name,short_name,latitude,longitude
XA,region,,XA-N,North,N.,4.175000,73.509000
XA,region,,,Isle,,,
XA,town,XA-N,,Port,,-0.640000,73.150000
XA,town,XA/Isle,,Cove,,,
XA,ward,XA-N/Port,,Old Quarter,,,
`
)

func seedTestGeographies(t *testing.T, tx pgx.Tx) {
	t.Helper()
	require.NoError(t, (&GeographyTypes{db: tx, data: []byte(testGeographyTypes)}).Run(t.Context(), env()))
	require.NoError(t, (&Geographies{db: tx, data: []byte(testGeographies)}).Run(t.Context(), env()))
}

func TestFeatureGeographySeedersAddPlacesUnderTheirParents(t *testing.T) {
	tx := testdb.OwnerTx(t)
	withTestCountry(t, tx)
	seedTestGeographies(t, tx)

	var path string
	require.NoError(t, tx.QueryRow(t.Context(), `
		SELECT r.name || ' > ' || p.name || ' > ' || w.name
		  FROM geographies w JOIN geographies p ON p.id = w.parent_id JOIN geographies r ON r.id = p.parent_id
		 WHERE w.country = 'XA' AND w.name = 'Old Quarter'`).Scan(&path))
	assert.Equal(t, "North > Port > Old Quarter", path)
	var short, at string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT short_name, latitude || ',' || longitude
		FROM geographies WHERE code = 'XA-N'`).Scan(&short, &at))
	assert.Equal(t, []string{"N.", "4.175000,73.509000"}, []string{short, at})
	var cove string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT p.name FROM geographies c JOIN geographies p ON p.id = c.parent_id
		WHERE c.country = 'XA' AND c.name = 'Cove'`).Scan(&cove))
	assert.Equal(t, "Isle", cove, "a level-1 place without a code is a parent too")
}

func TestFeatureGeographySeedersRestoreAndNeverDuplicate(t *testing.T) {
	tx := testdb.OwnerTx(t)
	withTestCountry(t, tx)
	seedTestGeographies(t, tx)
	_, err := tx.Exec(t.Context(), `UPDATE geographies SET name = 'Renamed', short_name = NULL, latitude = NULL,
		longitude = NULL, name_translations = '{"dv": "އުތުރު"}', active_to = active_from WHERE code = 'XA-N'`)
	require.NoError(t, err)
	_, err = tx.Exec(t.Context(), `UPDATE geographies SET latitude = 1, longitude = 1 WHERE country = 'XA' AND name = 'Port'`)
	require.NoError(t, err)
	_, err = tx.Exec(t.Context(), `UPDATE geography_types SET name = 'Renamed' WHERE country = 'XA' AND code = 'town'`)
	require.NoError(t, err)

	seedTestGeographies(t, tx)
	seedTestGeographies(t, tx)

	var name, short, dv, at, portAt string
	var retired bool
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT name, short_name, name_translations->>'dv', active_to IS NOT NULL,
		latitude || ',' || longitude FROM geographies WHERE code = 'XA-N'`).Scan(&name, &short, &dv, &retired, &at))
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT latitude || ',' || longitude FROM geographies
		WHERE country = 'XA' AND name = 'Port'`).Scan(&portAt))
	assert.Equal(t, "North", name, "a changed place is put back")
	assert.Equal(t, []string{"N.", "4.175000,73.509000", "-0.640000,73.150000"}, []string{short, at, portAt},
		"its short name and points too, with a code or without")
	assert.Equal(t, "އުތުރު", dv, "translations are the operators'")
	assert.True(t, retired, "the seeder never touches retirement dates")
	var typeName string
	require.NoError(t, tx.QueryRow(t.Context(),
		`SELECT name FROM geography_types WHERE country = 'XA' AND code = 'town'`).Scan(&typeName))
	assert.Equal(t, "Town", typeName, "a changed type is put back")

	var places, types int
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT
		(SELECT count(*) FROM geographies WHERE country = 'XA'),
		(SELECT count(*) FROM geography_types WHERE country = 'XA')`).Scan(&places, &types))
	assert.Equal(t, 5, places, "running again never duplicates")
	assert.Equal(t, 3, types)
}

func TestFeatureGeographiesNeedTheirTypes(t *testing.T) {
	tx := testdb.OwnerTx(t)
	withTestCountry(t, tx)
	err := (&Geographies{db: tx, data: []byte(testGeographies)}).Run(t.Context(), env())
	require.ErrorContains(t, err, "no type XA/region")
}

func TestFeatureAFailedGeographySeedChangesNothing(t *testing.T) {
	tx := testdb.OwnerTx(t)
	withTestCountry(t, tx)
	require.NoError(t, (&GeographyTypes{db: tx, data: []byte(testGeographyTypes)}).Run(t.Context(), env()))
	// The ward sits at the region's level under Port: the level trigger refuses it, so
	// North and Port, added before it in the same run, are rolled back too.
	bad := "country,type,parent,code,name,short_name,latitude,longitude\n" +
		"XA,region,,XA-N,North,,,\nXA,town,XA-N,,Port,,,\nXA,region,XA-N/Port,,Wrong,,,\n"
	require.Error(t, (&Geographies{db: tx, data: []byte(bad)}).Run(t.Context(), env()))
	var n int
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT count(*) FROM geographies WHERE country = 'XA'`).Scan(&n))
	assert.Zero(t, n)
}
