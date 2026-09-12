package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"
)

// ParseUUID parses a canonical UUID string (e.g. a Kratos subject) into pgtype.UUID.
func ParseUUID(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	if err := u.Scan(s); err != nil {
		return pgtype.UUID{}, fmt.Errorf("auth: parse uuid %q: %w", s, err)
	}
	return u, nil
}

// textOrNull maps an empty string to SQL NULL, else a valid text value.
func textOrNull(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

// nameI18n marshals a locale map to jsonb bytes, never nil — an empty/absent map becomes '{}' to
// satisfy users.name_i18n's NOT NULL DEFAULT '{}', not SQL NULL.
func nameI18n(m map[string]string) []byte {
	if len(m) == 0 {
		return []byte("{}")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return []byte("{}")
	}
	return b
}

// getOK performs a GET and returns nil only on HTTP 200 — used for readiness probes.
func getOK(ctx context.Context, hc *http.Client, url string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: status %d", url, resp.StatusCode)
	}
	return nil
}
