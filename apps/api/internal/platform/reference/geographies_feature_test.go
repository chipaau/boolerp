//go:build feature

package reference_test

import (
	"log/slog"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
	"github.com/boolmv/erp/apps/api/internal/platform/reference"
)

// geographyWorld adds, as the owner, country XA with three levels (region 1, town 2,
// ward 3) and a city at level 1, plus places: North (region), Port (town under North),
// and Old Quarter (ward under Port). Country XB has its own region type.
func geographyWorld(t *testing.T) pgx.Tx {
	t.Helper()
	tx := testdb.OwnerTx(t)
	insertTestCountry(t, tx)
	for _, sql := range []string{
		`INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XBB', 'Otherland', '+998')`,
		`INSERT INTO geography_types (country, code, name, level) VALUES
			('XA', 'region', 'Region', 1), ('XA', 'city', 'City', 1),
			('XA', 'town', 'Town', 2), ('XA', 'ward', 'Ward', 3), ('XB', 'region', 'Region', 1)`,
		`INSERT INTO geographies (country, type_id, code, name, short_name)
			SELECT 'XA', id, 'XA-N', 'North', 'N.' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		`INSERT INTO geographies (country, type_id, parent_id, name)
			SELECT 'XA', t.id, g.id, 'Port' FROM geography_types t, geographies g
			WHERE t.country = 'XA' AND t.code = 'town' AND g.country = 'XA' AND g.name = 'North'`,
		`INSERT INTO geographies (country, type_id, parent_id, name)
			SELECT 'XA', t.id, g.id, 'Old Quarter' FROM geography_types t, geographies g
			WHERE t.country = 'XA' AND t.code = 'ward' AND g.country = 'XA' AND g.name = 'Port'`,
	} {
		_, err := tx.Exec(t.Context(), sql)
		require.NoError(t, err, sql)
	}
	return tx
}

// place inserts a place of the type (country, typeCode) under the place named parent
// (none when empty), returning the database error.
func place(t *testing.T, tx pgx.Tx, country, typeCode, parent, name string) error {
	t.Helper()
	_, err := tx.Exec(t.Context(), `INSERT INTO geographies (country, type_id, parent_id, name)
		SELECT $1, (SELECT id FROM geography_types WHERE code = $2 AND country = $1),
		       (SELECT id FROM geographies WHERE country = $1 AND name = $3), $4`, country, typeCode, parent, name)
	return err
}

func assertRefused(t *testing.T, err error) {
	t.Helper()
	var pgErr *pgconn.PgError
	require.ErrorAs(t, err, &pgErr)
	// CHECK (and the level triggers), not null, unique, foreign key, or ON DELETE RESTRICT.
	assert.Contains(t, []string{"23514", "23502", "23505", "23503", "23001"}, pgErr.Code)
}

func TestFeatureTheRuntimeRoleCannotAddGeographies(t *testing.T) {
	_, err := testdb.Tx(t).Exec(t.Context(), `INSERT INTO geographies (country, type_id, name)
		VALUES ('MV', uuidv7(), 'Test place')`)
	var pgErr *pgconn.PgError
	require.ErrorAs(t, err, &pgErr)
	assert.Equal(t, "42501", pgErr.Code, "no write policy: row-level security refuses the insert")
}

func TestFeatureGeographyConstraints(t *testing.T) {
	for name, sql := range map[string]string{
		"no type": `INSERT INTO geographies (country, name) VALUES ('XA', 'Nowhere')`,
		"a type of another country": `INSERT INTO geographies (country, type_id, name)
			SELECT 'XA', id, 'South' FROM geography_types WHERE country = 'XB'`,
		"a parent in another country": `INSERT INTO geographies (country, type_id, parent_id, name)
			SELECT 'XB', t.id, g.id, 'South' FROM geography_types t, geographies g
			WHERE t.country = 'XB' AND g.country = 'XA' AND g.name = 'North'`,
		"blank name": `INSERT INTO geographies (country, type_id, name)
			SELECT 'XA', id, '  ' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"blank code": `INSERT INTO geographies (country, type_id, code, name)
			SELECT 'XA', id, ' ', 'South' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"blank short name": `INSERT INTO geographies (country, type_id, short_name, name)
			SELECT 'XA', id, ' ', 'South' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"translations not an object": `INSERT INTO geographies (country, type_id, name, name_translations)
			SELECT 'XA', id, 'South', '["Dhekunu"]' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"a translation under a bad tag": `INSERT INTO geographies (country, type_id, name, name_translations)
			SELECT 'XA', id, 'South', '{"Dhivehi": "Dhekunu"}' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"a blank translation": `INSERT INTO geographies (country, type_id, name, name_translations)
			SELECT 'XA', id, 'South', '{"dv": " "}' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"no translations at all": `INSERT INTO geographies (country, type_id, name, name_translations)
			SELECT 'XA', id, 'South', NULL FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"duplicate code": `INSERT INTO geographies (country, type_id, code, name)
			SELECT 'XA', id, 'XA-N', 'South' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"a sibling's name, in other case": `INSERT INTO geographies (country, type_id, name)
			SELECT 'XA', id, 'NORTH' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"a latitude without a longitude": `INSERT INTO geographies (country, type_id, name, latitude)
			SELECT 'XA', id, 'South', 4.2 FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"a latitude past 90": `INSERT INTO geographies (country, type_id, name, latitude, longitude)
			SELECT 'XA', id, 'South', 90.5, 73.5 FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"a longitude past 180": `INSERT INTO geographies (country, type_id, name, latitude, longitude)
			SELECT 'XA', id, 'South', 4.2, -180.5 FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"retired before in use": `INSERT INTO geographies (country, type_id, name, active_from, active_to)
			SELECT 'XA', id, 'South', now(), now() - interval '1 day' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		"deleting a place with children": `DELETE FROM geographies WHERE country = 'XA' AND name = 'North'`,
		"deleting a type with places":    `DELETE FROM geography_types WHERE country = 'XA' AND code = 'region'`,
	} {
		t.Run(name, func(t *testing.T) {
			tx := geographyWorld(t)
			_, err := tx.Exec(t.Context(), sql)
			assertRefused(t, err)
		})
	}
}

func TestFeatureGeographyLevelsHold(t *testing.T) {
	for name, try := range map[string]func(t *testing.T, tx pgx.Tx) error{
		"level 2 without a parent": func(t *testing.T, tx pgx.Tx) error { return place(t, tx, "XA", "town", "", "Lone Town") },
		"level 1 under a place":    func(t *testing.T, tx pgx.Tx) error { return place(t, tx, "XA", "city", "North", "Sub City") },
		"under a place of the same level": func(t *testing.T, tx pgx.Tx) error {
			return place(t, tx, "XA", "town", "Port", "Inner Town")
		},
		"under a place of a deeper level": func(t *testing.T, tx pgx.Tx) error {
			return place(t, tx, "XA", "town", "Old Quarter", "Deep Town")
		},
		"a place's new type leaving its children at its level": func(t *testing.T, tx pgx.Tx) error {
			_, err := tx.Exec(t.Context(), `UPDATE geographies SET type_id =
				(SELECT id FROM geography_types WHERE country = 'XA' AND code = 'ward') WHERE country = 'XA' AND name = 'Port'`)
			return err
		},
		"a new level for a type with places": func(t *testing.T, tx pgx.Tx) error {
			_, err := tx.Exec(t.Context(), `UPDATE geography_types SET level = 4 WHERE country = 'XA' AND code = 'town'`)
			return err
		},
	} {
		t.Run(name, func(t *testing.T) {
			assertRefused(t, try(t, geographyWorld(t)))
		})
	}
}

// Levels may be skipped (a ward straight under a region, as an island sits under a city),
// a name repeats under another parent (island names repeat across atolls), and a type
// without places may change level.
func TestFeatureGeographiesAllowWhatTheLevelsAllow(t *testing.T) {
	tx := geographyWorld(t)
	require.NoError(t, place(t, tx, "XA", "ward", "North", "Harbour"), "a skipped level")
	require.NoError(t, place(t, tx, "XA", "region", "", "South"))
	require.NoError(t, place(t, tx, "XA", "town", "South", "Port2"))
	_, err := tx.Exec(t.Context(), `INSERT INTO geographies (country, type_id, parent_id, name)
		SELECT 'XA', t.id, g.id, 'Port' FROM geography_types t, geographies g
		WHERE t.country = 'XA' AND t.code = 'town' AND g.country = 'XA' AND g.name = 'South'`)
	require.NoError(t, err, "a sibling name under another parent")
	_, err = tx.Exec(t.Context(), `UPDATE geography_types SET level = 2 WHERE country = 'XA' AND code = 'city'`)
	require.NoError(t, err, "no places of that type yet")
}

// is_translations is the one check of a <field>_translations column (C216): an object of
// language tags to non-blank strings.
func TestFeatureIsTranslationsAcceptsLanguageTagsToText(t *testing.T) {
	tx := testdb.Tx(t)
	for value, want := range map[string]bool{
		`{}`:               true,
		`{"dv": "މާފުށި"}`: true,
		`{"ta-IN": "x", "zh-Hant": "y", "es-419": "z"}`: true,
		`[]`:             false,
		`"dv"`:           false,
		`{"DV": "x"}`:    false,
		`{"dv-mv": "x"}`: false,
		`{"dv": ""}`:     false,
		`{"dv": 1}`:      false,
		`{"dv": null}`:   false,
	} {
		var got bool
		require.NoError(t, tx.QueryRow(t.Context(), `SELECT is_translations($1::jsonb)`, value).Scan(&got), value)
		assert.Equal(t, want, got, value)
	}
}

func TestFeatureAGeographyKeepsItsNameInOtherLanguages(t *testing.T) {
	tx := geographyWorld(t)
	var dv string
	require.NoError(t, tx.QueryRow(t.Context(), `UPDATE geographies SET name_translations = '{"dv": "އުތުރު"}'
		WHERE country = 'XA' AND name = 'North' RETURNING name_translations->>'dv'`).Scan(&dv))
	assert.Equal(t, "އުތުރު", dv)
	var none string
	require.NoError(t, tx.QueryRow(t.Context(), `SELECT name_translations::text FROM geographies WHERE country = 'XA' AND name = 'Port'`).Scan(&none))
	assert.Equal(t, "{}", none, "none by default")
}

func TestFeatureGeographyUpdatedAtFollowsChanges(t *testing.T) {
	tx := geographyWorld(t)
	assertUpdatedAtFollowsChanges(t, tx,
		`INSERT INTO geographies (country, type_id, name, updated_at)
			SELECT 'XA', id, 'South', '2000-01-01' FROM geography_types WHERE country = 'XA' AND code = 'region'`,
		`UPDATE geographies SET short_name = 'S.' WHERE country = 'XA' AND name = 'South'`,
		`SELECT updated_at = now() FROM geographies WHERE country = 'XA' AND name = 'South'`)
}

// addressWorldTx is XA's address levels and places for checking addresses (C215): region
// and city at level 1, town at 2, and ward at 3, all listed somewhere, and street at 4,
// listed nowhere, so typed. North (a region) holds Port (a town, holding the ward Old
// Quarter) and Quay (a town without wards); Capital (a city) has nothing under it; Gone
// is a retired region. XB is another country with a place.
type addressTestWorld struct {
	tx                              pgx.Tx
	north, port, quay, quarter, cap string
	gone, elsewhere                 string
}

func addressWorld(t *testing.T) addressTestWorld {
	t.Helper()
	tx := testdb.OwnerTx(t)
	insertTestCountry(t, tx)
	w := addressTestWorld{tx: tx}
	testdb.Exec(t, tx, `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XB', 'XBB', 'Otherland', '+998')`)
	testdb.Exec(t, tx, `INSERT INTO geography_types (country, code, name, level) VALUES
		('XA', 'region', 'Region', 1), ('XA', 'city', 'City', 1), ('XA', 'town', 'Town', 2),
		('XA', 'ward', 'Ward', 3), ('XA', 'street', 'Street', 4), ('XB', 'region', 'Region', 1)`)
	add := func(country, typ, parent, name string, extra ...string) string {
		cols, vals := "", ""
		if len(extra) > 0 {
			cols, vals = ", "+extra[0], ", "+extra[1]
		}
		return testdb.ID(t, tx, `INSERT INTO geographies (country, type_id, parent_id, name`+cols+`)
			SELECT $1, (SELECT id FROM geography_types WHERE country = $1 AND code = $2), nullif($3, '')::uuid, $4`+vals+`
			RETURNING id::text`, country, typ, parent, name)
	}
	w.north = add("XA", "region", "", "North", "short_name, latitude, longitude", "'N.', 4.175, 73.509")
	w.cap = add("XA", "city", "", "Capital")
	w.gone = add("XA", "region", "", "Gone", "active_from, active_to", "now() - interval '2 days', now() - interval '1 day'")
	w.port = add("XA", "town", w.north, "Port")
	w.quay = add("XA", "town", w.north, "Quay")
	w.quarter = add("XA", "ward", w.port, "Old Quarter")
	w.elsewhere = add("XB", "region", "", "South")
	return w
}

func checkAddress(t *testing.T, w addressTestWorld, country, place string, typed map[string]string) map[string]string {
	t.Helper()
	err := reference.New(w.tx, slog.New(slog.DiscardHandler)).CheckAddress(t.Context(), country, place, typed)
	if err == nil {
		return nil
	}
	var invalid *problem.ValidationError
	require.ErrorAs(t, err, &invalid)
	out := map[string]string{}
	for _, e := range invalid.Errors {
		out[e.Pointer] = e.Code
	}
	return out
}

// CheckAddress holds an address to its country's levels (C215): picked where places are
// listed, down to a place with nothing under it; typed, and required, where none are.
func TestFeatureAnAddressFollowsItsCountrysLevels(t *testing.T) {
	w := addressWorld(t)
	street := map[string]string{"street": "Sosun Magu"}
	for name, c := range map[string]struct {
		country, place string
		typed          map[string]string
		want           map[string]string
	}{
		"a ward, and its street":                   {"XA", w.quarter, street, nil},
		"a town without wards":                     {"XA", w.quay, street, nil},
		"a city with nothing under it":             {"XA", w.cap, street, nil},
		"no place in another country listing them": {"XB", "", nil, map[string]string{"#/geographyId": "required"}},
		"no place where places are listed":         {"XA", "", street, map[string]string{"#/geographyId": "required"}},
		"a place with places under it":             {"XA", w.port, street, map[string]string{"#/geographyId": "deeper"}},
		"a retired place":                          {"XA", w.gone, nil, map[string]string{"#/geographyId": "exists"}},
		"no such place":                            {"XA", "0192f6a0-0000-7000-8000-000000000000", nil, map[string]string{"#/geographyId": "exists"}},
		"a place of another country":               {"XA", w.elsewhere, nil, map[string]string{"#/geographyId": "country"}},
		"an unknown country":                       {"XQ", "", nil, map[string]string{"#/country": "exists"}},
		"the typed level missing":                  {"XA", w.quay, nil, map[string]string{"#/typedPlaces/street": "required"}},
		"a level that is not the country's":        {"XA", w.quay, map[string]string{"street": "x", "lane": "y"}, map[string]string{"#/typedPlaces/lane": "exists"}},
		"a listed level typed":                     {"XA", w.quay, map[string]string{"street": "x", "ward": "Typed Ward"}, map[string]string{"#/typedPlaces/ward": "excluded"}},
		"a level above the place typed":            {"XA", w.quarter, map[string]string{"street": "x", "region": "North"}, map[string]string{"#/typedPlaces/region": "excluded"}},
	} {
		assert.Equal(t, c.want, checkAddress(t, w, c.country, c.place, c.typed), name)
	}
}

func TestFeatureACountryWithoutLevelsNeedsNoPlaces(t *testing.T) {
	w := addressWorld(t)
	testdb.Exec(t, w.tx, `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XC', 'XCC', 'Plainland', '+997')`)
	assert.Nil(t, checkAddress(t, w, "XC", "", nil))
	assert.Equal(t, map[string]string{"#/typedPlaces/city": "exists"}, checkAddress(t, w, "XC", "", map[string]string{"city": "x"}))
}

func TestFeatureTwoTypedTypesOfOneLevelAreOneLevel(t *testing.T) {
	w := addressWorld(t)
	testdb.Exec(t, w.tx, `INSERT INTO geography_types (country, code, name, level) VALUES ('XA', 'lane', 'Lane', 4)`)
	assert.Nil(t, checkAddress(t, w, "XA", w.quay, map[string]string{"lane": "x"}), "either names level 4")
	assert.Equal(t, map[string]string{"#/typedPlaces/street": "unique"},
		checkAddress(t, w, "XA", w.quay, map[string]string{"lane": "x", "street": "y"}))
}

func TestFeatureAPlacesPathRunsFromLevelOne(t *testing.T) {
	w := addressWorld(t)
	path, err := reference.New(w.tx, slog.New(slog.DiscardHandler)).PlacePath(t.Context(), w.quarter)
	require.NoError(t, err)
	got := []string{}
	for _, g := range path {
		got = append(got, g.Name)
	}
	assert.Equal(t, []string{"North", "Port", "Old Quarter"}, got)
	assert.Equal(t, "ward", path[2].Type)
	path, err = reference.New(w.tx, slog.New(slog.DiscardHandler)).PlacePath(t.Context(), "not-a-place")
	require.NoError(t, err)
	assert.Empty(t, path)
}
