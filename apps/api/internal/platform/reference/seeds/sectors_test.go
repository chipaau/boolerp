package seeds

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTheEmbeddedSectors(t *testing.T) {
	sectors, err := ParseSectors(sectorsCSV)
	require.NoError(t, err)
	assert.Len(t, sectors, 15)
	assert.Contains(t, sectors, Sector{Code: "health", Name: "Health"})
	assert.Contains(t, sectors, Sector{Code: "trade", Name: "Wholesale and retail trade"})
}

func TestParseSectorsRejectsBadRows(t *testing.T) {
	const header = "code,name\n"
	for name, data := range map[string]string{
		"wrong header":   "code\nhealth\n",
		"missing column": header + "health\n",
		"bad code":       header + "Health,Health\n",
		"blank name":     header + "health, \n",
		"duplicate":      header + "health,Health\nhealth,Again\n",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := ParseSectors([]byte(data))
			assert.Error(t, err)
		})
	}
}
