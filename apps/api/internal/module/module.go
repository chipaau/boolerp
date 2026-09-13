// Package module defines the Module type modules mount onto the API. It exists as its own tiny,
// dependency-free package (rather than living in internal/httpapi) so that ANY package can build
// one — including internal/auth, which internal/httpapi itself depends on (for its session
// middleware) — without creating an import cycle. httpapi.Module is a type alias for Module, so
// existing code keeps writing httpapi.Module unchanged.
package module

import "github.com/go-chi/chi/v5"

// Module describes one feature mounted onto the API. Each module owns its own path namespace,
// handlers, and dependencies in its own package — Mount is a closure that module's own constructor
// (e.g. tenancy.Register, auth.Register) builds, already closed over whatever narrow deps it
// actually needs. The startup RLS coverage guard (internal/tenancy.CheckRLSCoverage) is schema-
// driven, not module-driven — it discovers tables directly from Postgres rather than depending on
// modules to self-report, so Module doesn't carry an RLS-related field.
type Module struct {
	Name  string
	Mount func(r chi.Router)
}
