//go:build feature

package reference_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type legalForm struct {
	ID, Code, Name, Category string
	IdentityDocument         *string
}

func TestFeatureTheLegalFormListShowsACountrysCurrentForms(t *testing.T) {
	authz := &stated{allow: true}
	h := referenceRouter(referenceWorld(t), authz)

	rec, p := get[legalForm](t, h, "/api/v1/legal-forms?country=XA")
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, []string{"list reference:legal_form"}, authz.cans)
	require.Len(t, p.Items, 2, "XB's form and the retired one are left out")
	company, ministry := p.Items[0], p.Items[1]
	assert.Equal(t, "x_company", company.Code, "by name")
	assert.Equal(t, "Test Company", company.Name)
	assert.Equal(t, "private", company.Category)
	require.NotNil(t, company.IdentityDocument)
	assert.Equal(t, "Test registration", *company.IdentityDocument)
	assert.NotEmpty(t, company.ID)
	assert.Equal(t, "x_ministry", ministry.Code)
	assert.Nil(t, ministry.IdentityDocument, "a form naming no document")
	assert.Equal(t, 2, p.Total)

	_, p = get[legalForm](t, h, "/api/v1/legal-forms?country=XA&page=9")
	assert.Empty(t, p.Items, "past the last page")
	assert.Equal(t, 2, p.Total, "still counts the matches")

	_, p = get[legalForm](t, h, "/api/v1/legal-forms?country=XA&q=minis")
	require.Len(t, p.Items, 1)
	assert.Equal(t, "x_ministry", p.Items[0].Code)
}

func TestFeatureTheLegalFormListNeedsACountry(t *testing.T) {
	rec, _ := get[legalForm](t, referenceRouter(referenceWorld(t), &stated{allow: true}), "/api/v1/legal-forms")
	assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	assert.Contains(t, rec.Body.String(), `"country"`)
}
