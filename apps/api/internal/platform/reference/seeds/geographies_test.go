package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTheEmbeddedGeographies(t *testing.T) {
	places, err := ParseGeographies(geographiesCSV)
	require.NoError(t, err)
	types, err := ParseGeographyTypes(geographyTypesCSV)
	require.NoError(t, err)
	level := map[string]int{}
	for _, ty := range types {
		level[ty.Country+"/"+ty.Code] = ty.Level
	}
	byKey := map[string]Geography{}
	for _, p := range places {
		byKey[p.Key()] = p
		l, ok := level[p.Country+"/"+p.Type]
		require.True(t, ok, "%s has a seeded type %s/%s", p.Key(), p.Country, p.Type)
		if p.Parent == "" {
			assert.Equal(t, 1, l, "%s has no parent, so is of level 1", p.Key())
		} else {
			parent := byKey[p.Parent]
			assert.Less(t, level[parent.Country+"/"+parent.Type], l, "%s sits under a lower level", p.Key())
		}
	}

	kaafu := byKey["MV-26"]
	assert.Equal(t, []string{"atoll", "Kaafu", "K."}, []string{kaafu.Type, kaafu.Name, kaafu.ShortName})
	assert.NotEmpty(t, kaafu.Latitude, "atolls have their point")
	for key, city := range map[string]string{"MV-MLE": "Malé City", "MV-01": "Addu City", "MV-29": "Fuvahmulah City",
		"MV/Kulhudhuffushi City": "Kulhudhuffushi City", "MV/Thinadhoo City": "Thinadhoo City"} {
		assert.Equal(t, []string{"city", city}, []string{byKey[key].Type, byKey[key].Name}, key)
	}
	assert.Equal(t, "island", byKey["MV/Kulhudhuffushi City/Kulhudhuffushi"].Type, "a city's island sits under it")
	assert.Equal(t, "island", byKey["MV-01/Hithadhoo"].Type, "Addu City's islands")
	assert.Equal(t, "island", byKey["MV/Seenu/Meedhoo"].Type, "Seenu's islands outside Addu City")
	assert.Equal(t, "island", byKey["MV-MLE/Malé"].Type)
	assert.Equal(t, "ward", byKey["MV-MLE/Malé/Henveiru"].Type)

	california := byKey["US-CA"]
	assert.Equal(t, []string{"state", "California"}, []string{california.Type, california.Name})
	assert.NotEmpty(t, california.Latitude)
	assert.Equal(t, "GB-SCT", byKey["GB-ABD"].Parent, "Aberdeenshire is in Scotland")
}

func TestParseGeographiesRejectsBadRows(t *testing.T) {
	const header = "country,type,parent,code,name,short_name,latitude,longitude\n"
	const atoll = "MV,atoll,,MV-26,Kaafu,K.,,\n"
	for name, data := range map[string]string{
		"wrong header":                "country,type\nMV,atoll\n",
		"missing column":              header + "MV,atoll,,MV-26,Kaafu,,\n",
		"bad country":                 header + "mv,atoll,,MV-26,Kaafu,,,\n",
		"bad type":                    header + "MV,Atoll,,MV-26,Kaafu,,,\n",
		"bad code":                    header + "MV,atoll,,MV26,Kaafu,,,\n",
		"another country's code":      header + "MV,atoll,,US-CA,Kaafu,,,\n",
		"blank name":                  header + "MV,atoll,,MV-26, ,,,\n",
		"blank short name":            header + "MV,atoll,,MV-26,Kaafu, ,,\n",
		"a latitude alone":            header + "MV,atoll,,MV-26,Kaafu,,4.2,\n",
		"a latitude past 90":          header + "MV,atoll,,MV-26,Kaafu,,91,73.5\n",
		"a longitude past 180":        header + "MV,atoll,,MV-26,Kaafu,,4.2,181\n",
		"more than six decimals":      header + "MV,atoll,,MV-26,Kaafu,,4.1234567,73.5\n",
		"not a number":                header + "MV,atoll,,MV-26,Kaafu,,north,73.5\n",
		"a parent not listed before":  header + "MV,island,MV-26,,Maafushi,,,\n" + atoll,
		"a parent in another country": header + atoll + "US,state,MV-26,,California,,,\n",
		"duplicate code":              header + atoll + "MV,atoll,,MV-26,Again,,,\n",
		"duplicate sibling":           header + atoll + "MV,island,MV-26,,Maafushi,,,\nMV,island,MV-26,,Maafushi,,,\n",
		"duplicate level-1 name":      header + "MV,atoll,,,Seenu,S.,,\nMV,atoll,,,Seenu,,,\n",
	} {
		_, err := ParseGeographies([]byte(data))
		assert.Error(t, err, name)
	}
}

func TestAPlaceWithoutACodeIsNamedUnderItsParentOrItsCountry(t *testing.T) {
	places, err := ParseGeographies([]byte("country,type,parent,code,name,short_name,latitude,longitude\n" +
		"MV,city,,MV-MLE,Malé City,,4.175,73.509\nMV,island,MV-MLE,,Malé,,,\nMV,ward,MV-MLE/Malé,,Henveiru,H.,,\n" +
		"MV,atoll,,,Seenu,S.,-0.63,73.16\nMV,island,MV/Seenu,,Meedhoo,,,\n"))
	require.NoError(t, err)
	keys := make([]string, len(places))
	for i, p := range places {
		keys[i] = p.Key()
	}
	assert.Equal(t, []string{"MV-MLE", "MV-MLE/Malé", "MV-MLE/Malé/Henveiru", "MV/Seenu", "MV/Seenu/Meedhoo"}, keys)
	assert.Equal(t, []string{"-0.63", "73.16"}, []string{places[3].Latitude, places[3].Longitude})
}
