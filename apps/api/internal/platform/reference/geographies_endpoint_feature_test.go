//go:build feature

package reference_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Endpoint tests (C156) for the pickers' lists, GET /api/v1/geography-types and
// GET /api/v1/geographies (C215), over the test country XA of addressWorld
// (geographies_feature_test.go).

type geographyTypeItem struct {
	ID, Country, Code, Name string
	Level, PlaceCount       int
}

type geographyItem struct {
	ID, Type, TypeName, Name string
	Level                    int
	Code, ShortName          *string
	Latitude, Longitude      *float64
	HasChildren              bool
}

func TestFeatureACountrysAddressLevelsAreListed(t *testing.T) {
	w := addressWorld(t)
	authz := &authztest.Stated{Allow: true}
	rec, p := get[geographyTypeItem](t, referenceRouter(w.tx, authz), "/api/v1/geography-types?country=XA")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:geography_type"}, authz.Cans)
	got := []string{}
	for _, i := range p.Items {
		got = append(got, i.Code)
	}
	assert.Equal(t, []string{"city", "region", "town", "ward", "street"}, got, "by level, then by name")
	assert.Equal(t, 3, p.Items[3].Level)
	places := map[string]int{}
	for _, i := range p.Items {
		places[i.Code] = i.PlaceCount
	}
	assert.Equal(t, map[string]int{"city": 1, "region": 1, "town": 2, "ward": 1, "street": 0}, places,
		"current places only: Gone is retired; street lists none, so it is typed")

	// Without a country, every country's, by the country's name first (as the list shows it, not its
	// code); q searches the name or the code.
	h := referenceRouter(w.tx, authz)
	testdb.Exec(t, w.tx, `UPDATE countries SET name = 'Aardvark Testland' WHERE code = 'XB'`)
	_, p = get[geographyTypeItem](t, h, "/api/v1/geography-types?q=region&pageSize=100")
	pairs := []string{}
	for _, i := range p.Items {
		if i.Country == "XA" || i.Country == "XB" {
			pairs = append(pairs, i.Country+"/"+i.Code)
		}
	}
	assert.Equal(t, []string{"XB/region", "XA/region"}, pairs, "Aardvark Testland before Testland")
	_, p = get[geographyTypeItem](t, h, "/api/v1/geography-types?country=XB")
	require.Len(t, p.Items, 1)
	assert.Equal(t, "XB", p.Items[0].Country)
	rec, _ = get[geographyTypeItem](t, h, "/api/v1/geography-types?sort=-country,level")
	assert.Equal(t, http.StatusOK, rec.Code)
	rec, _ = get[geographyTypeItem](t, h, "/api/v1/geography-types?sort=places")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, "an unknown sort")
}

func TestFeatureAPickerListsThePlacesUnderOneParent(t *testing.T) {
	w := addressWorld(t)
	h := referenceRouter(w.tx, &authztest.Stated{Allow: true})

	rec, p := get[geographyItem](t, h, "/api/v1/geographies?country=XA")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	names := func(items []geographyItem) []string {
		out := []string{}
		for _, i := range items {
			out = append(out, i.Name)
		}
		return out
	}
	assert.Equal(t, []string{"Capital", "North"}, names(p.Items), "level 1 without a parent, by name; Gone is retired")
	north := p.Items[1]
	assert.Equal(t, "region", north.Type)
	assert.Equal(t, "Region", north.TypeName)
	assert.True(t, north.HasChildren, "Port is under it")
	require.NotNil(t, north.ShortName)
	assert.Equal(t, "N.", *north.ShortName)
	require.NotNil(t, north.Latitude)
	assert.InDelta(t, 4.175, *north.Latitude, 1e-9)

	_, p = get[geographyItem](t, h, "/api/v1/geographies?country=XA&parent="+w.north)
	assert.Equal(t, []string{"Port", "Quay"}, names(p.Items))
	assert.True(t, p.Items[0].HasChildren)
	assert.False(t, p.Items[1].HasChildren)
	_, p = get[geographyItem](t, h, "/api/v1/geographies?country=XA&parent="+w.north+"&q=qua")
	assert.Equal(t, []string{"Quay"}, names(p.Items), "searched by name")
	_, p = get[geographyItem](t, h, "/api/v1/geographies?country=XA&q=n.")
	assert.Equal(t, []string{"North"}, names(p.Items), "and by short name")
	_, p = get[geographyItem](t, h, "/api/v1/geographies?country=XA&parent=not-a-place")
	assert.Empty(t, p.Items, "a parent that is no place has nothing under it")

	rec, _ = get[geographyItem](t, h, "/api/v1/geographies")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, "a country is required")
	rec, _ = get[geographyItem](t, referenceRouter(w.tx, &authztest.Stated{Allow: false}), "/api/v1/geographies?country=XA")
	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestFeatureAFailedPickerReadIsUnavailable(t *testing.T) {
	w := addressWorld(t)
	h := referenceRouter(w.tx, &authztest.Stated{Allow: true})
	_, err := w.tx.Exec(t.Context(), `SELECT 1/0`) // the transaction is now aborted
	require.Error(t, err)
	for _, path := range []string{"/api/v1/geography-types?country=XA", "/api/v1/geographies?country=XA"} {
		rec, _ := get[geographyItem](t, h, path)
		assert.Equal(t, http.StatusServiceUnavailable, rec.Code, path)
	}
}
