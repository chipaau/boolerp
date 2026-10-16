//go:build feature

package reference_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
)

// Endpoint tests (C156) for the pickers' lists, GET /api/v1/geography-types and
// GET /api/v1/geographies (C215), over the test country XA of addressWorld
// (geographies_feature_test.go).

type geographyTypeItem struct {
	ID, Code, Name string
	Level          int
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
	assert.Equal(t, []string{"city", "region", "town", "ward", "street"}, got, "by level, then as stored")
	assert.Equal(t, 3, p.Items[3].Level)

	rec, _ = get[geographyTypeItem](t, referenceRouter(w.tx, authz), "/api/v1/geography-types")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, "a country is required")
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
