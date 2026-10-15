//go:build feature

package reference_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization/authztest"
)

type country struct{ Code, Alpha3, Name, PhonePrefix string }

func TestFeatureTheCountryListShowsCurrentCountries(t *testing.T) {
	authz := &authztest.Stated{Allow: true}
	h := referenceRouter(referenceWorld(t), authz)

	rec, p := get[country](t, h, "/api/v1/countries?q=testland")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:country"}, authz.Cans, "Cerbos decides the list")
	assert.Equal(t, []country{
		{"XA", "XAA", "Xanadu Testland", "+991"}, {"XB", "XBB", "Xavier Testland", "+992"},
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
