package main

import (
	"log"
	"net"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/boolmv/erp/apps/api/internal/platform/config"
)

func main() {
	cfg, err := config.Load(os.Environ())
	if err != nil {
		log.Fatal(err)
	}

	r := chi.NewRouter()

	// Liveness (C25). Middleware must be registered before any route.
	r.Use(middleware.Heartbeat("/api/healthz"))

	// chi runs middleware only once at least one route exists.
	r.Get("/api", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	addr := net.JoinHostPort("", strconv.Itoa(cfg.Port))
	log.Printf("api listening on %s (environment %s)", addr, cfg.Environment)
	log.Fatal(http.ListenAndServe(addr, r))
}
