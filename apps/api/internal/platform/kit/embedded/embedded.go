// Package embedded opens a directory of files embedded in the binary (go:embed): a
// module's migrations or Cerbos policies, the BFF's app.
package embedded

import "io/fs"

// Dir returns fsys's directory dir as its own file system. dir is embedded with fsys, so
// a failure is a programming error and panics.
func Dir(fsys fs.FS, dir string) fs.FS {
	sub, err := fs.Sub(fsys, dir)
	if err != nil {
		panic(err)
	}
	return sub
}
