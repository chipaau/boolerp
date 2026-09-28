package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	r := chi.NewRouter()

	// Liveness (C25). Middleware must be registered before any route.
	r.Use(middleware.Heartbeat("/api/healthz"))

	// chi runs middleware only once at least one route exists.
	r.Get("/api", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	log.Println("api listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
