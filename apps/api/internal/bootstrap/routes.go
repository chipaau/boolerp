package bootstrap

import "net/http"

func routes() http.Handler {
	router := http.NewServeMux()
	router.HandleFunc("GET /api/healthz", func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte("{\"status\":\"ok\"}\n"))
	})

	return router
}
