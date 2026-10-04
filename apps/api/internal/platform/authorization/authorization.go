// Package authorization is the platform's authorization capability (C21, C149-C153):
// the Cerbos policies' shared pieces (the principal schema; later the shared derived
// roles) and the assembly of every module's policies into the one directory Cerbos
// reads. The Cerbos adapter, the only code that imports the SDK, comes later.
package authorization

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

//go:embed all:policies
var policies embed.FS

// Policies returns the shared policies and schemas, assembled as "authorization".
func Policies() fs.FS {
	sub, err := fs.Sub(policies, "policies")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}

// ModulePolicies is one module's policies: YAML policy files and their _test.yaml
// suites at its root, JSON Schemas under _schemas/ (C151).
type ModulePolicies struct {
	Name string
	FS   fs.FS
}

// marker names a directory Write owns, so it can replace what it wrote before and
// never empties a directory it did not create.
const marker = ".policies-assembled"

var moduleName = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// Write assembles modules into dir, the layout Cerbos's disk store reads: module m's
// policy files under m/, its schemas under _schemas/m/ (referenced as
// cerbos:///m/<file>). dir must be empty or written by Write before; its previous
// contents are replaced.
func Write(dir string, modules []ModulePolicies) error {
	if err := prepare(dir); err != nil {
		return err
	}
	for _, m := range modules {
		if !moduleName.MatchString(m.Name) {
			return fmt.Errorf("policies: invalid module name %q", m.Name)
		}
		err := fs.WalkDir(m.FS, ".", func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return err
			}
			target := path.Join(m.Name, p)
			if rest, ok := strings.CutPrefix(p, "_schemas/"); ok {
				target = path.Join("_schemas", m.Name, rest)
			}
			data, err := fs.ReadFile(m.FS, p)
			if err != nil {
				return err
			}
			out := filepath.Join(dir, filepath.FromSlash(target))
			if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil { //nolint:gosec // Cerbos runs as another user (65532) and must read these; policies hold no secrets.
				return err
			}
			return os.WriteFile(out, data, 0o644) //nolint:gosec // Cerbos runs as another user (65532) and must read these; policies hold no secrets.
		})
		if err != nil {
			return fmt.Errorf("policies: module %s: %w", m.Name, err)
		}
	}
	return os.WriteFile(filepath.Join(dir, marker), nil, 0o644) //nolint:gosec // Cerbos runs as another user (65532) and must read these; policies hold no secrets.
}

// prepare makes dir an empty directory, refusing one that holds anything Write did
// not put there.
func prepare(dir string) error {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return os.MkdirAll(dir, 0o755) //nolint:gosec // Cerbos runs as another user (65532) and must read these; policies hold no secrets.
	}
	if err != nil {
		return err
	}
	if len(entries) == 0 {
		return nil
	}
	if _, err := os.Stat(filepath.Join(dir, marker)); err != nil {
		return fmt.Errorf("policies: %s is not empty and was not written by this command; refusing to replace it", dir)
	}
	for _, e := range entries {
		if err := os.RemoveAll(filepath.Join(dir, e.Name())); err != nil {
			return err
		}
	}
	return nil
}
