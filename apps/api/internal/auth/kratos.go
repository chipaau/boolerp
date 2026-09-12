package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// ErrNoSession means Kratos reported no active session (401/403) — the caller replies 401.
var ErrNoSession = errors.New("auth: no active session")

// Traits mirrors the Kratos identity schema (docker/kratos/identity.schema.json).
type Traits struct {
	Email    string            `json:"email"`
	Name     string            `json:"name"`
	NameI18n map[string]string `json:"name_i18n"`
	Phone    string            `json:"phone"`
}

// KratosSession is the subset of GET /sessions/whoami the API consumes.
type KratosSession struct {
	ID       string `json:"id"`
	Active   bool   `json:"active"`
	Identity struct {
		ID     string `json:"id"`
		Traits Traits `json:"traits"`
	} `json:"identity"`
}

// Kratos is a client for the Kratos public + admin APIs. Chi holds no session state; it validates
// each request against Kratos (the stateful session authority), which gives instant revocation.
type Kratos struct {
	publicURL string
	adminURL  string
	hc        *http.Client
}

// NewKratos builds a Kratos client. adminURL is internal-only (provisioning + revocation, later).
func NewKratos(publicURL, adminURL string) *Kratos {
	return &Kratos{
		publicURL: publicURL,
		adminURL:  adminURL,
		hc:        &http.Client{Timeout: 5 * time.Second},
	}
}

// Whoami validates the session by forwarding the browser cookies to Kratos. Returns ErrNoSession
// on 401/403 so the middleware can reply 401 without leaking why.
func (k *Kratos) Whoami(ctx context.Context, cookie string) (*KratosSession, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, k.publicURL+"/sessions/whoami", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Cookie", cookie)

	resp, err := k.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("auth: whoami request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	switch resp.StatusCode {
	case http.StatusOK:
		var s KratosSession
		if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
			return nil, fmt.Errorf("auth: decode whoami: %w", err)
		}
		return &s, nil
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, ErrNoSession
	default:
		return nil, fmt.Errorf("auth: whoami unexpected status %d", resp.StatusCode)
	}
}

// HealthReady pings the Kratos public readiness endpoint (for /readyz).
func (k *Kratos) HealthReady(ctx context.Context) error {
	return getOK(ctx, k.hc, k.publicURL+"/health/ready")
}

// CreateIdentityWithPassword creates a Kratos identity with an initial password credential set
// directly via the admin API, bypassing the normal recovery-email onboarding flow. Dev/provisioning
// tooling only (see cmd/provision-dev) — real onboarding follows the documented recovery-link flow
// (see auth.md).
func (k *Kratos) CreateIdentityWithPassword(ctx context.Context, email, name, password string) (string, error) {
	body, err := json.Marshal(map[string]any{
		"schema_id": "default",
		"traits":    map[string]string{"email": email, "name": name},
		"credentials": map[string]any{
			"password": map[string]any{
				"config": map[string]string{"password": password},
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("auth: marshal identity: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, k.adminURL+"/admin/identities", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := k.hc.Do(req)
	if err != nil {
		return "", fmt.Errorf("auth: create identity request: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		var errBody bytes.Buffer
		_, _ = errBody.ReadFrom(resp.Body)
		return "", fmt.Errorf("auth: create identity: status %d: %s", resp.StatusCode, errBody.String())
	}

	var created struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		return "", fmt.Errorf("auth: decode created identity: %w", err)
	}
	return created.ID, nil
}
