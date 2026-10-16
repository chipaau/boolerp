package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTheEmbeddedGeographyTypes(t *testing.T) {
	types, err := ParseGeographyTypes(geographyTypesCSV)
	require.NoError(t, err)
	assert.Contains(t, types, GeographyType{Country: "MV", Code: "atoll", Name: "Atoll", Level: 1})
	assert.Contains(t, types, GeographyType{Country: "MV", Code: "island", Name: "Island", Level: 2})
	assert.Contains(t, types, GeographyType{Country: "US", Code: "state", Name: "State", Level: 1})

	countries, err := ParseCountries(countriesCSV)
	require.NoError(t, err)
	known := map[string]bool{}
	for _, c := range countries {
		known[c.Code] = true
	}
	for _, g := range types {
		assert.True(t, known[g.Country], "%s/%s names a seeded country", g.Country, g.Code)
	}
}

func TestParseGeographyTypesRejectsBadRows(t *testing.T) {
	const header = "country,code,name,level\n"
	for name, data := range map[string]string{
		"wrong header":   "country,code\nMV,atoll\n",
		"missing column": header + "MV,atoll,Atoll\n",
		"bad country":    header + "mv,atoll,Atoll,1\n",
		"bad code":       header + "MV,Atoll,Atoll,1\n",
		"blank name":     header + "MV,atoll, ,1\n",
		"level zero":     header + "MV,atoll,Atoll,0\n",
		"level ten":      header + "MV,atoll,Atoll,10\n",
		"no level":       header + "MV,atoll,Atoll,one\n",
		"duplicate":      header + "MV,atoll,Atoll,1\nMV,atoll,Again,2\n",
	} {
		_, err := ParseGeographyTypes([]byte(data))
		assert.Error(t, err, name)
	}
}
