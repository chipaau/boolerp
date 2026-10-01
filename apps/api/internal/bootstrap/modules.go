package bootstrap

import (
	"github.com/go-chi/chi/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/auth"
)

// modules are the API's modules, constructed by Run. Each registers its own
// routes relative to its prefix and applies its own authentication; bootstrap
// only decides the prefixes. The router's default middleware (newRouter)
// applies to every module.
type modules struct {
	auth *auth.Module
}

// mount attaches each module under its prefix.
func mount(r chi.Router, m modules) {
	r.Route("/api/auth", m.auth.Routes)
}
