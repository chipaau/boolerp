package migrations

import (
	"embed"
	"io/fs"
)

// Files contains ordered SQL migrations shipped with the API release.
//
//go:embed migrations
var files embed.FS

func Files() (fs.FS, error) {
	return fs.Sub(files, "migrations")
}
