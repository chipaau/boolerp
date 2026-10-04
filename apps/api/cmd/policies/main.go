// Command policies assembles the edition's Cerbos policies, tests, and schemas into
// one directory, the layout Cerbos's disk store and `cerbos compile` read (C151):
// each module's policies under <module>/, its schemas under _schemas/<module>/.
//
//	go run ./cmd/policies -out /policies
//
// The directory must be empty or written by this command before; its previous
// contents are replaced, so Cerbos (watching it) reloads the new set.
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/boolmv/erp/apps/api/internal/edition/full"
	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
)

func main() {
	out := flag.String("out", "", "directory to write the policies into (required)")
	flag.Parse()
	if *out == "" {
		fmt.Fprintln(os.Stderr, "policies: -out is required")
		os.Exit(2)
	}
	if err := authorization.Write(*out, full.Policies); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("policies: wrote %d modules to %s\n", len(full.Policies), *out)
}
