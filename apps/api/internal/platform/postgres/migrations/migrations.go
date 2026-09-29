// Package migrations embeds the application's Goose SQL migrations, so each
// release binary carries exactly the migrations it was built with (C46).
package migrations

import (
	"embed"
	"io/fs"
)

//go:embed sql
var embedded embed.FS

// FS returns the migrations directory. Goose reads only its .sql files.
func FS() fs.FS {
	sub, err := fs.Sub(embedded, "sql")
	if err != nil {
		panic(err) // the directory is embedded above, so this cannot fail
	}
	return sub
}
