package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/rls"
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

// ErrForbidden is the policy answering "no" — the decision itself, not a malfunction. Any OTHER
// error from Authorize means the decision could not be made at all (Cerbos unreachable, non-200,
// undecodable body), which is a 502 rather than a 403.
var ErrForbidden = errors.New("auth: forbidden")

// Authorize asks Cerbos whether p may perform action on r — the one general-purpose enforcement
// point, called per-handler (not a blanket middleware: a check with no resource loaded can't
// evaluate attribute-based grants, e.g. "is this your own record" — see docs/roadmap.md's component
// 05 notes).
//
// It returns ONLY an error — nil to allow, ErrForbidden to deny, anything else for an authz that
// could not be decided — deliberately, rather than (bool, error). With a separate bool, a caller
// writing `allowed, _ :=` reports a Cerbos outage as "forbidden", which is fail-closed but lies
// about why. Here the sole way to proceed is err == nil, so there is no bool to misread: a caller
// that ignores the error cannot accidentally treat an outage as a decision.
func (c *Cerbos) Authorize(ctx context.Context, p AuthzPrincipal, r AuthzResource, action string) error {
	roles := append([]string{"user"}, p.Capabilities...)
	principal := cerbosPrincipal{
		ID:    p.ID,
		Roles: roles,
		Attr:  map[string]any{"is_internal_member": p.IsInternalMember},
	}
	return c.isAllowed(ctx, principal, resourceObj{Kind: r.Kind, ID: r.ID, Attr: r.Attr}, action)
}

func (c *Cerbos) isAllowed(ctx context.Context, p cerbosPrincipal, res resourceObj, action string) error {
	// Carry OUR request id into Cerbos's own audit log, so a decision recorded there joins up with
	// the same id in our logs, traces, and error responses (see respond.Error) instead of every
	// decision being labelled identically.
	requestID := middleware.GetReqID(ctx)
	if requestID == "" {
		requestID = "chk"
	}
	body, err := json.Marshal(checkReq{
		RequestID: requestID,
		Principal: p,
		Resources: []cerbosResource{{Resource: res, Actions: []string{action}}},
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/check/resources", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("auth: cerbos check: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("auth: cerbos status %d", resp.StatusCode)
	}
	var cr checkResp
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return err
	}
	// No result, or any effect other than an explicit allow, is a denial — deny-by-default is the
	// shape of this function, not a branch someone has to remember to write.
	if len(cr.Results) == 0 || cr.Results[0].Actions[action] != "EFFECT_ALLOW" {
		return ErrForbidden
	}
	return nil
}

// AllowSelfProfileRead checks the scaffold "self" policy (resource "profile", action "read").
// Kept as a thin wrapper over Authorize for the existing /me endpoint; same error contract —
// nil allows, ErrForbidden denies, anything else means no decision was reached.
func (c *Cerbos) AllowSelfProfileRead(ctx context.Context, userID string) error {
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
// dbTxBeginner is satisfied by both *pgxpool.Pool and pgx.Tx — everything BuildOperatorPrincipal
// needs: sqlc.DBTX's query methods for the (platform-table, non-RLS) membership checks, plus Begin
// to scope the RLS-protected user_roles lookup to the internal tenant via rls.WithTenant.
type dbTxBeginner interface {
	sqlc.DBTX
	rls.Beginner
}

func BuildOperatorPrincipal(ctx context.Context, db dbTxBeginner, userID pgtype.UUID) (AuthzPrincipal, error) {
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

	// user_roles is RLS-scoped (00010_authorization_rls.sql), so this read needs app.current_tenant
	// set to the internal tenant — a plain query through db would see zero rows and silently
	// resolve every operator as capability-less.
	var caps []string
	err = rls.WithTenant(ctx, db, internalTenant.ID, func(ctx context.Context, tx pgx.Tx) error {
		c, err := sqlc.New(tx).ListActiveCapabilitiesForUserInTenant(ctx, sqlc.ListActiveCapabilitiesForUserInTenantParams{
			UserID:   userID,
			TenantID: internalTenant.ID,
		})
		if err != nil {
			return err
		}
		caps = c
		return nil
	})
	if err != nil {
		return AuthzPrincipal{}, fmt.Errorf("auth: list capabilities: %w", err)
	}
	p.Capabilities = caps
	return p, nil
}
