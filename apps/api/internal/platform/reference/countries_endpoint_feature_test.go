//go:build feature

package reference_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

type country struct {
	Code, Alpha3, Name, PhonePrefix string
	GeographyCount                  int
}

func TestFeatureTheCountryListShowsCurrentCountries(t *testing.T) {
	authz := &authztest.Stated{Allow: true}
	h := referenceRouter(referenceWorld(t), authz)

	rec, p := get[country](t, h, "/api/v1/countries?q=testland")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:country"}, authz.Cans, "Cerbos decides the list")
	assert.Equal(t, []country{
		{"XA", "XAA", "Xanadu Testland", "+991", 0}, {"XB", "XBB", "Xavier Testland", "+992", 0},
	}, p.Items, "by name")
	assert.Equal(t, 300, p.PageSize, "every country in one page")
	assert.Equal(t, 2, p.Total)

	_, p = get[country](t, h, "/api/v1/countries?q=x&sort=-code&pageSize=300")
	codes := []string{}
	for _, c := range p.Items {
		if strings.HasPrefix(c.Name, "X") && len(c.Code) == 2 && c.Code[0] == 'X' {
			codes = append(codes, c.Code)
		}
	}
	assert.Equal(t, []string{"XL", "XB", "XA"}, codes, "retiring later is still current; retired is not")

	rec, _ = get[country](t, h, "/api/v1/countries?pageSize=301")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
}

// geographyCount is how many current places a country lists for address pickers (C215):
// retired places are left out.
func TestFeatureACountryCountsItsCurrentPlaces(t *testing.T) {
	tx := referenceWorld(t)
	testdb.Exec(t, tx, `INSERT INTO geography_types (country, code, name, level) VALUES ('XA', 'region', 'Region', 1)`)
	testdb.Exec(t, tx, `INSERT INTO geographies (country, type_id, name)
		SELECT 'XA', id, n FROM geography_types, unnest(ARRAY['North', 'South']) AS n WHERE country = 'XA'`)
	testdb.Exec(t, tx, `INSERT INTO geographies (country, type_id, name, active_from, active_to)
		SELECT 'XA', id, 'Gone', now() - interval '2 days', now() - interval '1 day' FROM geography_types WHERE country = 'XA'`)
	_, p := get[country](t, referenceRouter(tx, &authztest.Stated{Allow: true}), "/api/v1/countries?q=testland")
	require.Len(t, p.Items, 2)
	assert.Equal(t, map[string]int{"XA": 2, "XB": 0}, map[string]int{p.Items[0].Code: p.Items[0].GeographyCount,
		p.Items[1].Code: p.Items[1].GeographyCount})
}
