package full

import (
	"io/fs"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
)

// Every policy has its test suite and declares the schemas of the attributes it
// uses, and every schema it references exists (C151). Without schemas, Cerbos
// evaluates a request that is missing an attribute instead of rejecting it.
func TestEveryPolicyHasTestsAndSchemas(t *testing.T) {
	schemas := map[string]bool{}
	type policyFile struct{ module, path string }
	var files []policyFile
	for _, m := range Policies {
		require.NoError(t, fs.WalkDir(m.FS, ".", func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			if rest, ok := strings.CutPrefix(p, "_schemas/"); ok {
				schemas["cerbos:///"+m.Name+"/"+rest] = true
				return nil
			}
			if strings.HasSuffix(p, ".yaml") && !strings.HasSuffix(p, "_test.yaml") {
				files = append(files, policyFile{m.Name, p})
			}
			return nil
		}), m.Name)
	}
	require.NotEmpty(t, files)

	for _, m := range Policies {
		for _, f := range files {
			if f.module != m.Name {
				continue
			}
			name := f.module + "/" + f.path
			_, err := fs.Stat(m.FS, strings.TrimSuffix(f.path, ".yaml")+"_test.yaml")
			assert.NoError(t, err, "%s has no test suite beside it", name)

			data, err := fs.ReadFile(m.FS, f.path)
			require.NoError(t, err)
			var doc struct {
				ResourcePolicy *struct {
					Schemas struct {
						PrincipalSchema struct{ Ref string } `yaml:"principalSchema"`
						ResourceSchema  struct{ Ref string } `yaml:"resourceSchema"`
					} `yaml:"schemas"`
				} `yaml:"resourcePolicy"`
			}
			require.NoError(t, yaml.Unmarshal(data, &doc), name)
			if doc.ResourcePolicy == nil {
				continue // derived roles and other shared pieces carry no schemas
			}
			for kind, ref := range map[string]string{
				"principal": doc.ResourcePolicy.Schemas.PrincipalSchema.Ref,
				"resource":  doc.ResourcePolicy.Schemas.ResourceSchema.Ref,
			} {
				if assert.NotEmpty(t, ref, "%s declares no %s schema", name, kind) {
					assert.True(t, schemas[ref], "%s references %s, which no module provides", name, ref)
				}
			}
		}
	}
}
