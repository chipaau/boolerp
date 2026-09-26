package httpserver

import "net/http"

func serveRoute(router *http.ServeMux, writer http.ResponseWriter, request *http.Request) {
	handler, pattern := router.Handler(request)
	if pattern == "" {
		// Let ServeMux determine 404 versus 405 and its Allow header. Only the
		// generated error body is replaced; redirects retain their normal behavior.
		handler.ServeHTTP(&routeErrorWriter{ResponseWriter: writer, request: request}, request)
		return
	}
	// Calling the selected handler directly would skip PathValue/Pattern setup.
	router.ServeHTTP(writer, request)
}

type routeErrorWriter struct {
	http.ResponseWriter
	request *http.Request
	discard bool
}

func (writer *routeErrorWriter) WriteHeader(status int) {
	if status == http.StatusNotFound || status == http.StatusMethodNotAllowed {
		writer.discard = true
		WriteProblem(writer.ResponseWriter, writer.request, status, "")
		return
	}
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *routeErrorWriter) Write(body []byte) (int, error) {
	if writer.discard {
		return len(body), nil
	}
	return writer.ResponseWriter.Write(body)
}
