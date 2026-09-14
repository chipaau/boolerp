package tenancy

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/erp/internal/auth"
	"github.com/boolmv/erp/internal/db/sqlc"
	"github.com/boolmv/erp/internal/httpapi"
	"github.com/boolmv/erp/internal/observability"
	"github.com/boolmv/erp/internal/respond"
)

func uuidString(id pgtype.UUID) string { return uuid.UUID(id.Bytes).String() }

// Deps are the collaborators this package's own HTTP handlers need — narrower than the
// platform-wide httpapi.PlatformDeps: no Cerbos (httpapi.AdminRoute itself owns the authorization check,
// taking pool/cerbos directly) and no MetricsEnabled (irrelevant to a handler).
type Deps struct {
	Pool   *pgxpool.Pool
	Kratos *auth.Kratos
}

// resourceKind is the Cerbos resource every route in this module authorizes against (see
// docker/cerbos/policies/resource_tenant.yaml).
const resourceKind = "tenant"

// Register builds this package's httpapi.Module from the platform-wide PlatformDeps: its own path
// namespace ("/admin") and its own narrowed Deps for its handlers. main.go passes the whole
// PlatformDeps once; each module decides for itself what it actually needs from it — nothing is
// picked apart by hand at the call site.
func Register(platform httpapi.PlatformDeps) httpapi.Module {
	deps := Deps{Pool: platform.Pool, Kratos: platform.Kratos}
	return httpapi.Module{
		Name: "tenancy",
		Mount: func(r chi.Router) {
			r.Route("/admin", func(r chi.Router) {
				httpapi.AdminRoute(r, http.MethodGet, "/tenants", resourceKind, "list", platform.Pool, platform.Cerbos, deps, adminListTenants)
				httpapi.AdminRoute(r, http.MethodGet, "/tenants/{id}", resourceKind, "get", platform.Pool, platform.Cerbos, deps, adminGetTenant)
				httpapi.AdminRoute(r, http.MethodPost, "/tenants", resourceKind, "provision", platform.Pool, platform.Cerbos, deps, adminCreateTenant)
				httpapi.AdminRoute(r, http.MethodPost, "/tenants/{id}/suspend", resourceKind, "suspend", platform.Pool, platform.Cerbos, deps, adminTransitionHandler(SuspendTenant))
				httpapi.AdminRoute(r, http.MethodPost, "/tenants/{id}/reactivate", resourceKind, "reactivate", platform.Pool, platform.Cerbos, deps, adminTransitionHandler(ReactivateTenant))
				httpapi.AdminRoute(r, http.MethodPost, "/tenants/{id}/archive", resourceKind, "archive", platform.Pool, platform.Cerbos, deps, adminTransitionHandler(ArchiveTenant))
			})
		},
	}
}

// tenantResponse is the operator-facing tenant shape — a deliberately small projection, not every
// column on sqlc.Tenant.
type tenantResponse struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

func toTenantResponse(t sqlc.Tenant) tenantResponse {
	return tenantResponse{
		ID: uuidString(t.ID), Slug: t.Slug, Code: t.Code, Name: t.Name,
		Country: t.Country, Status: t.Status, CreatedAt: t.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func adminListTenants(w http.ResponseWriter, r *http.Request, d Deps, _ auth.AuthzPrincipal) {
	tenants, err := sqlc.New(d.Pool).ListTenants(r.Context())
	if err != nil {
		observability.LoggerFrom(r.Context()).Error("list tenants", "err", err)
		respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
		return
	}
	resp := make([]tenantResponse, len(tenants))
	for i, t := range tenants {
		resp[i] = toTenantResponse(t)
	}
	respond.JSONBody(w, http.StatusOK, resp)
}

func adminGetTenant(w http.ResponseWriter, r *http.Request, d Deps, _ auth.AuthzPrincipal) {
	id, err := auth.ParseUUID(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(r.Context(), w, http.StatusBadRequest, "bad tenant id")
		return
	}
	t, err := sqlc.New(d.Pool).GetTenantByID(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		respond.Error(r.Context(), w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		observability.LoggerFrom(r.Context()).Error("get tenant", "err", err)
		respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
		return
	}
	respond.JSONBody(w, http.StatusOK, toTenantResponse(t))
}

// maxCreateTenantBody bounds the request body — generous for this payload, finite for the server.
const maxCreateTenantBody = 64 << 10

type createTenantRequest struct {
	Slug                string `json:"slug"`
	Code                string `json:"code"`
	Name                string `json:"name"`
	Country             string `json:"country"`
	PartyTypeCode       string `json:"party_type_code"`
	InstitutionTypeCode string `json:"institution_type_code"`
	OwnerEmail          string `json:"owner_email"`
	OwnerName           string `json:"owner_name"`
}

func adminCreateTenant(w http.ResponseWriter, r *http.Request, d Deps, p auth.AuthzPrincipal) {
	var req createTenantRequest
	// Cap the body: this is an admin endpoint, but an unbounded decode is an unbounded allocation.
	// A body that isn't JSON at all is a 400 — there are no fields to report problems against.
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxCreateTenantBody)).Decode(&req); err != nil {
		respond.Error(r.Context(), w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Country == "" {
		req.Country = "MV"
	}
	if errs := validateCreateTenant(&req); errs.Any() {
		respond.Invalid(r.Context(), w, errs)
		return
	}

	// The two codes are caller-supplied values that must resolve to real rows, so "no such row" is
	// that field's problem (422) while any other error is ours (500) — never a 4xx blaming the
	// caller for a database that happened to be unreachable.
	q := sqlc.New(d.Pool)
	partyTypeID, err := q.GetPartyTypeIDByCode(r.Context(), req.PartyTypeCode)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			observability.LoggerFrom(r.Context()).Error("lookup party type", "err", err)
			respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
			return
		}
		respond.Invalid(r.Context(), w, respond.FieldErrors{"party_type_code": {"is not a known party type"}})
		return
	}
	institutionTypeID, err := q.GetInstitutionTypeIDByCode(r.Context(), sqlc.GetInstitutionTypeIDByCodeParams{
		CountryCode: pgtype.Text{String: req.Country, Valid: true}, Code: req.InstitutionTypeCode,
	})
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			observability.LoggerFrom(r.Context()).Error("lookup institution type", "err", err)
			respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
			return
		}
		respond.Invalid(r.Context(), w, respond.FieldErrors{
			"institution_type_code": {"is not a known institution type for country " + req.Country},
		})
		return
	}

	actorID, err := auth.ParseUUID(p.ID)
	if err != nil {
		respond.Error(r.Context(), w, http.StatusInternalServerError, "bad principal id")
		return
	}

	result, err := Provision(r.Context(), d.Pool, d.Kratos, ProvisionParams{
		Slug: req.Slug, Code: req.Code, Name: req.Name, Country: req.Country,
		PartyTypeID: partyTypeID, InstitutionTypeID: institutionTypeID,
		OwnerEmail: req.OwnerEmail, OwnerName: req.OwnerName, ActorUserID: actorID,
	})
	if err != nil {
		// Only an actual uniqueness conflict is the caller's to fix, and we can say WHICH field
		// collided. Everything else — Kratos unreachable, audit write failed, tx rolled back — is a
		// server fault that used to be reported as "slug/code may already be taken".
		if field := uniqueViolationField(err); field != "" {
			respond.Invalid(r.Context(), w, respond.FieldErrors{field: {"is already taken"}})
			return
		}
		observability.LoggerFrom(r.Context()).Error("provision tenant", "err", err)
		respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
		return
	}
	respond.JSONBody(w, http.StatusCreated, map[string]any{
		"tenant": toTenantResponse(result.Tenant), "recovery_link": result.RecoveryLink,
	})
}

// adminTransitionHandler wraps a tenancy status-transition function (SuspendTenant/
// ReactivateTenant/ArchiveTenant — all sharing this exact signature) into an AdminRoute handler,
// so the three routes don't each re-implement the same id/actor parsing + response shape.
func adminTransitionHandler(
	transition func(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error),
) func(w http.ResponseWriter, r *http.Request, d Deps, p auth.AuthzPrincipal) {
	return func(w http.ResponseWriter, r *http.Request, d Deps, p auth.AuthzPrincipal) {
		id, err := auth.ParseUUID(chi.URLParam(r, "id"))
		if err != nil {
			respond.Error(r.Context(), w, http.StatusBadRequest, "bad tenant id")
			return
		}
		actorID, err := auth.ParseUUID(p.ID)
		if err != nil {
			respond.Error(r.Context(), w, http.StatusInternalServerError, "bad principal id")
			return
		}
		t, err := transition(r.Context(), d.Pool, id, actorID)
		switch {
		case errors.Is(err, ErrTenantNotFound):
			respond.Error(r.Context(), w, http.StatusNotFound, "not found")
			return
		case err != nil:
			// The tenant exists but its status forbids this action — a client error, not ours, and
			// the operator is told which status blocked it rather than getting a bare "internal".
			var illegal *IllegalTransitionError
			if errors.As(err, &illegal) {
				respond.Error(r.Context(), w, http.StatusConflict, illegal.Error())
				return
			}
			observability.LoggerFrom(r.Context()).Error("tenant transition", "err", err)
			respond.Error(r.Context(), w, http.StatusInternalServerError, "internal")
			return
		}
		respond.JSONBody(w, http.StatusOK, toTenantResponse(t))
	}
}
