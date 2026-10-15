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

type institutionType struct {
	Code, Name string
	Sector     struct{ Code, Name string }
}

func TestFeatureTheInstitutionTypeListShowsCurrentTypesBySector(t *testing.T) {
	authz := &authztest.Stated{Allow: true}
	h := referenceRouter(referenceWorld(t), authz)

	rec, p := get[institutionType](t, h, "/api/v1/institution-types?q=X%20")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:institution_type"}, authz.Cans)
	got := []string{}
	for _, it := range p.Items {
		if strings.HasPrefix(it.Code, "x_") {
			got = append(got, it.Sector.Code+"/"+it.Code)
		}
	}
	assert.Equal(t, []string{"x_alpha/x_bank", "x_alpha/x_clinic", "x_beta/x_school"}, got,
		"by sector, then name; retired types and types of retired sectors are left out")
	assert.Equal(t, "X Alpha sector", p.Items[0].Sector.Name)
	assert.Equal(t, "X Bank", p.Items[0].Name)

	_, p = get[institutionType](t, h, "/api/v1/institution-types?sector=x_beta")
	require.Len(t, p.Items, 1)
	assert.Equal(t, "x_school", p.Items[0].Code)
}
