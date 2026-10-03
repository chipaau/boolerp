package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTheEmbeddedListIsTheFullISOList(t *testing.T) {
	countries, err := ParseCountries(countriesCSV)
	require.NoError(t, err)
	assert.Len(t, countries, 249)
	assert.Contains(t, countries, Country{Code: "MV", Alpha3: "MDV", Name: "Maldives", PhonePrefix: "+960"})
}

func TestParseCountriesRejectsBadRows(t *testing.T) {
	const header = "code,alpha3,name,phone_prefix\n"
	for name, data := range map[string]string{
		"wrong header":     "code,name\nMV,Maldives\n",
		"missing column":   header + "MV,MDV,Maldives\n",
		"lowercase code":   header + "mv,MDV,Maldives,+960\n",
		"bad alpha-3":      header + "MV,MD1,Maldives,+960\n",
		"blank name":       header + "MV,MDV, ,+960\n",
		"prefix without +": header + "MV,MDV,Maldives,960\n",
		"long prefix":      header + "MV,MDV,Maldives,+96000\n",
		"duplicate code":   header + "MV,MDV,Maldives,+960\nMV,MDA,Other,+1\n",
		"duplicate alpha3": header + "MV,MDV,Maldives,+960\nXM,MDV,Other,+1\n",
		"empty":            "",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseCountries([]byte(data))
			assert.Error(t, err)
		})
	}
}

func TestParseCountriesSkipsComments(t *testing.T) {
	countries, err := ParseCountries([]byte("# source\ncode,alpha3,name,phone_prefix\n# note\nMV,MDV,Maldives,+960\n"))
	require.NoError(t, err)
	assert.Equal(t, []Country{{Code: "MV", Alpha3: "MDV", Name: "Maldives", PhonePrefix: "+960"}}, countries)
}
