package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTheEmbeddedInstitutionTypes(t *testing.T) {
	types, err := ParseInstitutionTypes(institutionTypesCSV)
	require.NoError(t, err)
	assert.Len(t, types, 48)
	assert.Contains(t, types, InstitutionType{Code: "hospital", Sector: "health", Name: "Hospital"})
	assert.Contains(t, types, InstitutionType{Code: "dive_centre", Sector: "tourism", Name: "Dive centre"})

	sectors, err := ParseSectors(sectorsCSV)
	require.NoError(t, err)
	used := map[string]bool{}
	known := map[string]bool{}
	for _, s := range sectors {
		known[s.Code] = true
	}
	for _, it := range types {
		assert.True(t, known[it.Sector], "%s names a seeded sector", it.Code)
		used[it.Sector] = true
	}
	for _, s := range sectors {
		assert.True(t, used[s.Code], "sector %s has at least one type", s.Code)
	}
}

func TestParseInstitutionTypesRejectsBadRows(t *testing.T) {
	const header = "code,sector,name\n"
	for name, data := range map[string]string{
		"wrong header":   "code,name\nhospital,Hospital\n",
		"missing column": header + "hospital,health\n",
		"bad code":       header + "Hospital,health,Hospital\n",
		"bad sector":     header + "hospital,Health,Hospital\n",
		"blank name":     header + "hospital,health, \n",
		"duplicate":      header + "hospital,health,Hospital\nhospital,health,Again\n",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseInstitutionTypes([]byte(data))
			assert.Error(t, err)
		})
	}
}
