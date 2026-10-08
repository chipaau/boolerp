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
		LegalForm: "statutory_body", Timezone: "Indian/Maldives", Parent: "moh", Types: []string{"hospital"}})
	assert.Contains(t, samples, Sample{Slug: "new-island-clinic", Code: "NIC", Name: "New Island Clinic", Country: "MV",
		LegalForm: "private_company", Timezone: "Indian/Maldives", IdentityNumber: "C-2007/2024"})
	for _, s := range samples {
		assert.NotEqual(t, "workspace", s.Slug, "the operator is not a sample")
	}
}

func TestParseSamplesRejectsBadRows(t *testing.T) {
	const header = "slug,code,name,country,legal_form,timezone,identity_number,parent,types\n"
	for name, data := range map[string]string{
		"wrong header":   "slug,code\nx,X\n",
		"missing column": header + "x,X,Name,MV,f,Etc/UTC,,\n",
		"no name":        header + "x,X, ,MV,f,Etc/UTC,,,\n",
		"no country":     header + "x,X,A,,f,Etc/UTC,,,\n",
		"duplicate":      header + "x,X,A,MV,f,Etc/UTC,,,\nx,Y,B,MV,f,Etc/UTC,,,\n",
		"later parent":   header + "x,X,A,MV,f,Etc/UTC,,y,\ny,Y,B,MV,f,Etc/UTC,,,\n",
		"no legal form":  header + "x,X,A,MV,,Etc/UTC,,,clinic\n",
		"no time zone":   header + "x,X,A,MV,f,,,,clinic\n",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseSamples([]byte(data))
			assert.Error(t, err)
		})
	}
}

func TestTheEmbeddedSampleDomains(t *testing.T) {
	domains, err := ParseSampleDomains(sampleDomainsCSV)
	require.NoError(t, err)
	assert.Contains(t, domains, SampleDomain{Tenant: "cyryx", Host: "portal.cyryx.test", Kind: "custom",
		Serves: "academics.student", Status: "active", Primary: true})

	samples, err := ParseSamples(sampleTenantsCSV)
	require.NoError(t, err)
	slugs := map[string]bool{}
	for _, s := range samples {
		slugs[s.Slug] = true
	}
	for _, d := range domains {
		assert.True(t, slugs[d.Tenant], "%s belongs to a sample tenant", d.Host)
	}
}

func TestParseSampleDomainsRejectsBadRows(t *testing.T) {
	const header = "tenant,host,kind,serves,status,primary\n"
	for name, data := range map[string]string{
		"wrong header":    "tenant,host\nx,y\n",
		"missing column":  header + "x,a.test,custom,workspace,active\n",
		"no host":         header + "x,,custom,workspace,active,no\n",
		"duplicate":       header + "x,a.test,custom,workspace,active,no\ny,a.test,custom,workspace,active,no\n",
		"unknown kind":    header + "x,a.test,other,workspace,active,no\n",
		"revoked":         header + "x,a.test,custom,workspace,revoked,no\n",
		"bad primary":     header + "x,a.test,custom,workspace,active,maybe\n",
		"pending primary": header + "x,a.test,custom,workspace,pending,yes\n",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseSampleDomains([]byte(data))
			assert.Error(t, err)
		})
	}
}
