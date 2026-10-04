package authorization

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var mod = fstest.MapFS{
	"thing.yaml":          {Data: []byte("policy")},
	"thing_test.yaml":     {Data: []byte("tests")},
	"_schemas/thing.json": {Data: []byte("{}")},
	"sub/other.yaml":      {Data: []byte("nested")},
}

func read(t *testing.T, dir, p string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, filepath.FromSlash(p)))
	require.NoError(t, err, p)
	return string(b)
}

func TestWriteLaysOutModulesForCerbos(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "policies")
	require.NoError(t, Write(dir, []ModulePolicies{{Name: "things", FS: mod}}))
	assert.Equal(t, "policy", read(t, dir, "things/thing.yaml"))
	assert.Equal(t, "tests", read(t, dir, "things/thing_test.yaml"))
	assert.Equal(t, "nested", read(t, dir, "things/sub/other.yaml"))
	assert.Equal(t, "{}", read(t, dir, "_schemas/things/thing.json"), "schemas under _schemas/<module>/")
}

func TestWriteReplacesWhatItWroteBefore(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, Write(dir, []ModulePolicies{{Name: "things", FS: mod}}))
	require.NoError(t, Write(dir, []ModulePolicies{{Name: "others", FS: fstest.MapFS{"x.yaml": {Data: []byte("x")}}}}))
	assert.NoDirExists(t, filepath.Join(dir, "things"), "the previous set is gone")
	assert.Equal(t, "x", read(t, dir, "others/x.yaml"))
}

func TestWriteRefusesADirectoryItDidNotWrite(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "precious.txt"), []byte("keep"), 0o644))
	require.ErrorContains(t, Write(dir, []ModulePolicies{{Name: "things", FS: mod}}), "refusing")
	assert.Equal(t, "keep", read(t, dir, "precious.txt"))
}

func TestWriteRefusesABadModuleName(t *testing.T) {
	require.ErrorContains(t, Write(t.TempDir(), []ModulePolicies{{Name: "../escape", FS: mod}}), "invalid module name")
}

func TestThePrincipalSchemaIsEmbedded(t *testing.T) {
	_, err := Policies().Open("_schemas/principal.json")
	require.NoError(t, err)
}
