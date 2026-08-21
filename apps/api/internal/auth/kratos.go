package auth

import (
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
	Email  string `json:"email"`
	Name   string `json:"name"`
	NameDv string `json:"name_dv"`
	Phone  string `json:"phone"`
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
