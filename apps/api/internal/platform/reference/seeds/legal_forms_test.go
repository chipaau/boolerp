package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTheEmbeddedLegalForms(t *testing.T) {
	forms, err := ParseLegalForms(legalFormsCSV)
	require.NoError(t, err)
	assert.Len(t, forms, 12)
	assert.Contains(t, forms, LegalForm{Country: "MV", Code: "private_company", Name: "Private company (Pvt Ltd)",
		Category: "private", IdentityDocument: "Company registration number"})
	assert.Contains(t, forms, LegalForm{Country: "MV", Code: "local_council", Name: "Local council (city, atoll, island)",
		Category: "government"})

	countries, err := ParseCountries(countriesCSV)
	require.NoError(t, err)
	known := map[string]bool{}
	for _, c := range countries {
		known[c.Code] = true
	}
	for _, f := range forms {
		assert.True(t, known[f.Country], "%s/%s names a seeded country", f.Country, f.Code)
	}
}

func TestParseLegalFormsRejectsBadRows(t *testing.T) {
	const header = "country,code,name,category,identity_document\n"
	for name, data := range map[string]string{
		"wrong header":     "country,code\nMV,x\n",
		"missing column":   header + "MV,private_company,Private,private\n",
		"bad country":      header + "mv,private_company,Private,private,\n",
		"bad code":         header + "MV,Private Company,Private,private,\n",
		"blank name":       header + "MV,private_company, ,private,\n",
		"unknown category": header + "MV,private_company,Private,commercial,\n",
		"blank document":   header + "MV,private_company,Private,private, \n",
		"duplicate":        header + "MV,private_company,Private,private,\nMV,private_company,Again,private,\n",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseLegalForms([]byte(data))
			assert.Error(t, err)
		})
	}
}

func TestTheSameCodeInTwoCountries(t *testing.T) {
	forms, err := ParseLegalForms([]byte("country,code,name,category,identity_document\n" +
		"MV,private_company,Private company,private,Company registration number\n" +
		"LK,private_company,Private company,private,\n"))
	require.NoError(t, err)
	assert.Len(t, forms, 2)
}
