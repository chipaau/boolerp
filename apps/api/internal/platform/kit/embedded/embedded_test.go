package embedded

import (
	"io/fs"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDirOpensTheDirectory(t *testing.T) {
	fsys := fstest.MapFS{"migrations/00001_x.sql": {Data: []byte("SELECT 1")}}
	got, err := fs.ReadFile(Dir(fsys, "migrations"), "00001_x.sql")
	require.NoError(t, err)
	assert.Equal(t, "SELECT 1", string(got))
}

func TestDirPanicsOnABadName(t *testing.T) {
	assert.Panics(t, func() { Dir(fstest.MapFS{}, "../outside") })
}
