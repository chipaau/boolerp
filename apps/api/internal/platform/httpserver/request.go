package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"strings"
)

type requestIDKey struct{}

// RequestID returns the server-generated correlation ID, or an empty string
// outside the HTTP foundation. It is not an identity or authorization claim.
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// DecodeJSON reads one JSON object into destination, rejecting unknown fields
// and additional JSON values. It writes a safe problem response on failure.
// Call it behind NewHandler so all reads have the request body limit applied.
func DecodeJSON(writer http.ResponseWriter, request *http.Request, destination any) bool {
	mediaType, _, err := mime.ParseMediaType(request.Header.Get("Content-Type"))
	encoding := request.Header.Get("Content-Encoding")
	if err != nil || mediaType != "application/json" || (encoding != "" && !strings.EqualFold(encoding, "identity")) {
		WriteProblem(writer, request, http.StatusUnsupportedMediaType, "Use an uncompressed application/json request body.")
		return false
	}

	decoder := json.NewDecoder(request.Body)
	var body json.RawMessage
	if err := decoder.Decode(&body); err != nil {
		return invalidBody(writer, request, err)
	}
	var extra json.RawMessage
	if err := decoder.Decode(&extra); err != io.EOF {
		return invalidBody(writer, request, err)
	}
	if trimmed := bytes.TrimSpace(body); len(trimmed) == 0 || trimmed[0] != '{' {
		return invalidBody(writer, request, nil)
	}
	decoder = json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		var invalid *json.InvalidUnmarshalError
		if errors.As(err, &invalid) {
			panic(err) // A programmer error; recovery produces a safe 500 response.
		}
		return invalidBody(writer, request, err)
	}
	return true
}

func invalidBody(writer http.ResponseWriter, request *http.Request, err error) bool {
	var tooLarge *http.MaxBytesError
	var networkError net.Error
	switch {
	case errors.As(err, &tooLarge):
		WriteProblem(writer, request, http.StatusRequestEntityTooLarge, "Request body exceeds the size limit.")
	case errors.As(err, &networkError) && networkError.Timeout():
		WriteProblem(writer, request, http.StatusRequestTimeout, "Request body was not received in time.")
	default:
		WriteProblem(writer, request, http.StatusBadRequest, "Request body must contain one JSON object with valid fields.")
	}
	return false
}
