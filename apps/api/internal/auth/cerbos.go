package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Cerbos is a thin client over the Cerbos PDP HTTP API. SCAFFOLD: only the check the backbone /me
// endpoint needs. Policy-driven roles/capabilities and per-request enforcement are component 05.
type Cerbos struct {
	baseURL string
	hc      *http.Client
}

// NewCerbos builds a Cerbos client (internal-only PDP).
func NewCerbos(baseURL string) *Cerbos {
	return &Cerbos{baseURL: baseURL, hc: &http.Client{Timeout: 5 * time.Second}}
}

type cerbosPrincipal struct {
	ID    string   `json:"id"`
	Roles []string `json:"roles"`
}

type cerbosResource struct {
	Resource resourceObj `json:"resource"`
	Actions  []string    `json:"actions"`
}

type resourceObj struct {
	Kind string         `json:"kind"`
	ID   string         `json:"id"`
	Attr map[string]any `json:"attr,omitempty"`
}

type checkReq struct {
	RequestID string           `json:"requestId"`
	Principal cerbosPrincipal  `json:"principal"`
	Resources []cerbosResource `json:"resources"`
}

type checkResp struct {
	Results []struct {
		Actions map[string]string `json:"actions"`
	} `json:"results"`
}

// isAllowed asks Cerbos whether principal may perform action on the resource.
func (c *Cerbos) isAllowed(ctx context.Context, p cerbosPrincipal, res resourceObj, action string) (bool, error) {
	body, err := json.Marshal(checkReq{
		RequestID: "chk",
		Principal: p,
		Resources: []cerbosResource{{Resource: res, Actions: []string{action}}},
	})
	if err != nil {
		return false, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/check/resources", bytes.NewReader(body))
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.hc.Do(req)
	if err != nil {
		return false, fmt.Errorf("auth: cerbos check: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("auth: cerbos status %d", resp.StatusCode)
	}
	var cr checkResp
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return false, err
	}
	if len(cr.Results) == 0 {
		return false, nil
	}
	return cr.Results[0].Actions[action] == "EFFECT_ALLOW", nil
}

// AllowSelfProfileRead checks the scaffold policy (resource "profile", action "read", derived role
// "self"). Role "user" is a PLACEHOLDER — real roles come from platform data in component 05.
func (c *Cerbos) AllowSelfProfileRead(ctx context.Context, userID string) (bool, error) {
	return c.isAllowed(ctx,
		cerbosPrincipal{ID: userID, Roles: []string{"user"}},
		resourceObj{Kind: "profile", ID: userID, Attr: map[string]any{"owner_id": userID}},
		"read",
	)
}

// Health pings the Cerbos health endpoint (for /readyz).
func (c *Cerbos) Health(ctx context.Context) error {
	return getOK(ctx, c.hc, c.baseURL+"/_cerbos/health")
}
