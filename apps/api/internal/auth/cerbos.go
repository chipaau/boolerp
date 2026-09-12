package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/Bool-Maldives/erp/internal/db/sqlc"
)

// Cerbos is a thin client over the Cerbos PDP HTTP API — consulted live per request (FR-AUTHZ-01),
// never baked into a token.
type Cerbos struct {
	baseURL string
	hc      *http.Client
}

// NewCerbos builds a Cerbos client (internal-only PDP).
func NewCerbos(baseURL string) *Cerbos {
	return &Cerbos{baseURL: baseURL, hc: &http.Client{Timeout: 5 * time.Second, Transport: otelhttp.NewTransport(http.DefaultTransport)}}
}

// AuthzPrincipal is everything Cerbos needs to decide: the base "user" role always applies (so
// resource policies keyed off it, like the "self" derived role, keep working); Capabilities are
// the capability slugs held via CURRENT role assignments in the relevant tenant context (see
// BuildOperatorPrincipal); IsInternalMember gates the "operator" derived role (FR-AUTHZ-04) — only
// via this attribute, never inferred from a capability string alone.
type AuthzPrincipal struct {
	ID               string
	IsInternalMember bool
	Capabilities     []string
}

// AuthzResource is the (kind, id, attrs) Cerbos checks the action against.
type AuthzResource struct {
	Kind string
	ID   string
	Attr map[string]any
}

type cerbosPrincipal struct {
	ID    string         `json:"id"`
	Roles []string       `json:"roles"`
	Attr  map[string]any `json:"attr,omitempty"`
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

// Authorize asks Cerbos whether p may perform action on r — the one general-purpose enforcement
// point, called per-handler (not a blanket middleware: a check with no resource loaded can't
// evaluate attribute-based grants, e.g. "is this your own record" — see docs/roadmap.md's component
// 05 notes). Deny-by-default: any transport/decode error is treated as NOT allowed.
func (c *Cerbos) Authorize(ctx context.Context, p AuthzPrincipal, r AuthzResource, action string) (bool, error) {
	roles := append([]string{"user"}, p.Capabilities...)
	principal := cerbosPrincipal{
		ID:    p.ID,
		Roles: roles,
		Attr:  map[string]any{"is_internal_member": p.IsInternalMember},
	}
	return c.isAllowed(ctx, principal, resourceObj{Kind: r.Kind, ID: r.ID, Attr: r.Attr}, action)
}

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

// AllowSelfProfileRead checks the scaffold "self" policy (resource "profile", action "read").
// Kept as a thin wrapper over Authorize for the existing /me endpoint.
func (c *Cerbos) AllowSelfProfileRead(ctx context.Context, userID string) (bool, error) {
	return c.Authorize(ctx,
		AuthzPrincipal{ID: userID},
		AuthzResource{Kind: "profile", ID: userID, Attr: map[string]any{"owner_id": userID}},
		"read",
	)
}

// Health pings the Cerbos health endpoint (for /readyz).
func (c *Cerbos) Health(ctx context.Context) error {
	return getOK(ctx, c.hc, c.baseURL+"/_cerbos/health")
}

// BuildOperatorPrincipal builds the AuthzPrincipal for an operator/admin action: is this user a
// member of the ONE internal tenant, and if so, what capabilities do their roles there grant them
// (FR-AUTHZ-04 — platform:* capabilities only act platform-wide via such a role). A non-member gets
// IsInternalMember=false and no capabilities, so any platform:* check denies by default. Takes
// sqlc.DBTX (not concretely *pgxpool.Pool) so it can run inside a caller's transaction too.
func BuildOperatorPrincipal(ctx context.Context, db sqlc.DBTX, userID pgtype.UUID) (AuthzPrincipal, error) {
	q := sqlc.New(db)

	isInternal, err := q.IsInternalTenantMember(ctx, userID)
	if err != nil {
		return AuthzPrincipal{}, fmt.Errorf("auth: is internal tenant member: %w", err)
	}
	p := AuthzPrincipal{ID: uuidString(userID), IsInternalMember: isInternal}
	if !isInternal {
		return p, nil
	}

	internalTenant, err := q.GetInternalTenant(ctx)
	if err != nil {
		return AuthzPrincipal{}, fmt.Errorf("auth: get internal tenant: %w", err)
	}
	caps, err := q.ListActiveCapabilitiesForUserInTenant(ctx, sqlc.ListActiveCapabilitiesForUserInTenantParams{
		UserID:   userID,
		TenantID: internalTenant.ID,
	})
	if err != nil {
		return AuthzPrincipal{}, fmt.Errorf("auth: list capabilities: %w", err)
	}
	p.Capabilities = caps
	return p, nil
}
