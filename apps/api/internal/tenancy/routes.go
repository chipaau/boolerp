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

// resourceKind is the Cerbos resource these routes authorize against (see
// docker/cerbos/policies/resource_tenant.yaml).
const resourceKind = "tenant"

// tenantRoutes groups the handlers for the TENANT resource and the collaborators they need. One such
// type per resource this module owns, so a second resource (memberships, visibility grants) adds its
// own type and its own routes rather than more loose functions sharing this file.
type tenantRoutes struct {
	pool   *pgxpool.Pool
	kratos *auth.Kratos
}

// Register builds this module's httpapi.Module. tenancy is a PLATFORM module: other modules depend
// on it as a service (WithTenant, the RLS guard, Host-based tenant resolution), so it keeps its own
// name and its own package rather than being split per resource.
//
// There is no "admin route" concept in this API. A route is just a route; who may call it is decided
// by the middleware in front of it, never by its path. Every route below is Bool-operator surface
// because auth.OperatorsOnly gates the group — not because it sits under some /admin prefix.
func Register(platform httpapi.PlatformDeps) httpapi.Module {
	h := tenantRoutes{pool: platform.Pool, kratos: platform.Kratos}
	can := func(action string) func(http.Handler) http.Handler {
		return auth.RequirePermission(platform.Cerbos, resourceKind, action)
	}
	return httpapi.Module{
		Name: "tenancy",
		Mount: func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(auth.OperatorsOnly(platform.Pool))

				r.With(can("list")).Get("/tenants", h.list)
				r.With(can("provision")).Post("/tenants", h.create)
				r.With(can("get")).Get("/tenants/{id}", h.get)
				r.With(can("suspend")).Post("/tenants/{id}/suspend", h.transition(SuspendTenant))
				r.With(can("reactivate")).Post("/tenants/{id}/reactivate", h.transition(ReactivateTenant))
				r.With(can("archive")).Post("/tenants/{id}/archive", h.transition(ArchiveTenant))
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

func (h tenantRoutes) list(w http.ResponseWriter, r *http.Request) {
	tenants, err := sqlc.New(h.pool).ListTenants(r.Context())
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

func (h tenantRoutes) get(w http.ResponseWriter, r *http.Request) {
	id, err := auth.ParseUUID(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(r.Context(), w, http.StatusBadRequest, "bad tenant id")
		return
	}
	t, err := sqlc.New(h.pool).GetTenantByID(r.Context(), id)
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

func (h tenantRoutes) create(w http.ResponseWriter, r *http.Request) {
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
	q := sqlc.New(h.pool)
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

	actorID, err := actorFrom(r)
	if err != nil {
		respond.Error(r.Context(), w, http.StatusInternalServerError, "bad principal id")
		return
	}

	result, err := Provision(r.Context(), h.pool, h.kratos, ProvisionParams{
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

// transition wraps a status-transition function (SuspendTenant/ReactivateTenant/ArchiveTenant — all
// sharing this exact signature) into a handler, so the three routes don't each re-implement the same
// id/actor parsing and error mapping.
func (h tenantRoutes) transition(
	apply func(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := auth.ParseUUID(chi.URLParam(r, "id"))
		if err != nil {
			respond.Error(r.Context(), w, http.StatusBadRequest, "bad tenant id")
			return
		}
		actorID, err := actorFrom(r)
		if err != nil {
			respond.Error(r.Context(), w, http.StatusInternalServerError, "bad principal id")
			return
		}

		t, err := apply(r.Context(), h.pool, id, actorID)
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

// actorFrom is who is performing the action, for the audit trail. The authz principal is already in
// the context (auth.OperatorsOnly resolved it), so handlers read it rather than being handed it.
func actorFrom(r *http.Request) (pgtype.UUID, error) {
	azp, ok := auth.AuthzPrincipalFrom(r.Context())
	if !ok {
		return pgtype.UUID{}, errors.New("tenancy: no authorization principal in context")
	}
	return auth.ParseUUID(azp.ID)
}
