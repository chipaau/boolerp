package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTheEmbeddedSampleTenants(t *testing.T) {
	samples, err := ParseSamples(sampleTenantsCSV)
	require.NoError(t, err)
	assert.Len(t, samples, 17)
	assert.Contains(t, samples, Sample{Slug: "haah", Code: "HAAH", Name: "Haa Alif Atoll Hospital", Country: "MV",
		LegalForm: "statutory_body", Parent: "moh", Types: []string{"hospital"}})
	assert.Contains(t, samples, Sample{Slug: "new-island-clinic", Code: "NIC", Name: "New Island Clinic", Country: "MV"})
	for _, s := range samples {
		assert.NotEqual(t, "workspace", s.Slug, "the operator is not a sample")
	}
}

func TestParseSamplesRejectsBadRows(t *testing.T) {
	const header = "slug,code,name,country,legal_form,identity_number,parent,types\n"
	for name, data := range map[string]string{
		"wrong header":      "slug,code\nx,X\n",
		"missing column":    header + "x,X,Name,MV,,,\n",
		"no name":           header + "x,X, ,MV,,,,\n",
		"no country":        header + "x,X,A,,,,,\n",
		"duplicate":         header + "x,X,A,MV,,,,\nx,Y,B,MV,,,,\n",
		"later parent":      header + "x,X,A,MV,,,y,\ny,Y,B,MV,,,,\n",
		"form without type": header + "x,X,A,MV,private_company,C-1,,\n",
		"type without form": header + "x,X,A,MV,,,,clinic\n",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseSamples([]byte(data))
			assert.Error(t, err)
		})
	}
}
