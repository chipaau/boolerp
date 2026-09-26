package httpserver

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// WriteJSON encodes before committing the response so encoding failures can
// still become an error response. Transport errors are returned to the caller.
func WriteJSON(writer http.ResponseWriter, status int, value any) error {
	return writeJSON(writer, status, "application/json", value)
}

func writeJSON(writer http.ResponseWriter, status int, contentType string, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	body = append(body, '\n')
	writer.Header().Set("Content-Type", contentType)
	writer.Header().Set("Content-Length", strconv.Itoa(len(body)))
	writer.WriteHeader(status)
	_, err = writer.Write(body)
	return err
}

// WriteProblem writes RFC 9457 problem details. Detail must be a safe message,
// never a raw error or a value supplied by the caller.
func WriteProblem(writer http.ResponseWriter, request *http.Request, status int, detail string) {
	problem := struct {
		Type      string `json:"type"`
		Title     string `json:"title"`
		Status    int    `json:"status"`
		Detail    string `json:"detail,omitempty"`
		RequestID string `json:"request_id"`
	}{"about:blank", http.StatusText(status), status, detail, RequestID(request.Context())}
	writer.Header().Set("Cache-Control", "no-store")
	// This fixed string/integer payload cannot fail JSON encoding. A disconnected
	// client cannot receive a replacement response if writing fails.
	_ = writeJSON(writer, status, "application/problem+json", problem)
}
