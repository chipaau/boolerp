package tenancy

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/boolmv/goerp/internal/auth"
	"github.com/boolmv/goerp/internal/db/sqlc"
	"github.com/boolmv/goerp/internal/httpapi"
	"github.com/boolmv/goerp/internal/observability"
)

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

// Routes mounts the operator-facing tenant CRUD (component 04, flat scope) under /v1/admin — every
// route goes through httpapi.AdminRoute, never a raw chi method (Phase D's backstop). A
// httpapi.Module, registered explicitly in cmd/api/main.go.
func Routes(r chi.Router, d httpapi.Deps) {
	r.Route("/admin", func(r chi.Router) {
		httpapi.AdminRoute(r, http.MethodGet, "/tenants", "list", d, adminListTenants)
		httpapi.AdminRoute(r, http.MethodGet, "/tenants/{id}", "get", d, adminGetTenant)
		httpapi.AdminRoute(r, http.MethodPost, "/tenants", "provision", d, adminCreateTenant)
		httpapi.AdminRoute(r, http.MethodPost, "/tenants/{id}/suspend", "suspend", d, adminTransitionHandler(SuspendTenant))
		httpapi.AdminRoute(r, http.MethodPost, "/tenants/{id}/reactivate", "reactivate", d, adminTransitionHandler(ReactivateTenant))
		httpapi.AdminRoute(r, http.MethodPost, "/tenants/{id}/archive", "archive", d, adminTransitionHandler(ArchiveTenant))
	})
}

func adminListTenants(w http.ResponseWriter, r *http.Request, d httpapi.Deps, _ auth.AuthzPrincipal) {
	tenants, err := sqlc.New(d.Pool).ListTenants(r.Context())
	if err != nil {
		observability.LoggerFrom(r.Context()).Error("list tenants", "err", err)
		httpapi.WriteJSON(w, http.StatusInternalServerError, `{"error":"internal"}`)
		return
	}
	resp := make([]tenantResponse, len(tenants))
	for i, t := range tenants {
		resp[i] = toTenantResponse(t)
	}
	httpapi.WriteJSONBody(w, http.StatusOK, resp)
}

func adminGetTenant(w http.ResponseWriter, r *http.Request, d httpapi.Deps, _ auth.AuthzPrincipal) {
	id, err := auth.ParseUUID(chi.URLParam(r, "id"))
	if err != nil {
		httpapi.WriteJSON(w, http.StatusBadRequest, `{"error":"bad tenant id"}`)
		return
	}
	t, err := sqlc.New(d.Pool).GetTenantByID(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpapi.WriteJSON(w, http.StatusNotFound, `{"error":"not found"}`)
		return
	}
	if err != nil {
		observability.LoggerFrom(r.Context()).Error("get tenant", "err", err)
		httpapi.WriteJSON(w, http.StatusInternalServerError, `{"error":"internal"}`)
		return
	}
	httpapi.WriteJSONBody(w, http.StatusOK, toTenantResponse(t))
}

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

func adminCreateTenant(w http.ResponseWriter, r *http.Request, d httpapi.Deps, p auth.AuthzPrincipal) {
	var req createTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpapi.WriteJSON(w, http.StatusBadRequest, `{"error":"invalid body"}`)
		return
	}
	if req.Slug == "" || req.Code == "" || req.Name == "" || req.PartyTypeCode == "" ||
		req.InstitutionTypeCode == "" || req.OwnerEmail == "" || req.OwnerName == "" {
		httpapi.WriteJSON(w, http.StatusBadRequest, `{"error":"missing required field"}`)
		return
	}
	if req.Country == "" {
		req.Country = "MV"
	}

	q := sqlc.New(d.Pool)
	partyTypeID, err := q.GetPartyTypeIDByCode(r.Context(), req.PartyTypeCode)
	if err != nil {
		httpapi.WriteJSON(w, http.StatusBadRequest, `{"error":"invalid party_type_code"}`)
		return
	}
	institutionTypeID, err := q.GetInstitutionTypeIDByCode(r.Context(), sqlc.GetInstitutionTypeIDByCodeParams{
		CountryCode: pgtype.Text{String: req.Country, Valid: true}, Code: req.InstitutionTypeCode,
	})
	if err != nil {
		httpapi.WriteJSON(w, http.StatusBadRequest, `{"error":"invalid institution_type_code for this country"}`)
		return
	}

	actorID, err := auth.ParseUUID(p.ID)
	if err != nil {
		httpapi.WriteJSON(w, http.StatusInternalServerError, `{"error":"bad principal id"}`)
		return
	}

	result, err := Provision(r.Context(), d.Pool, d.Kratos, ProvisionParams{
		Slug: req.Slug, Code: req.Code, Name: req.Name, Country: req.Country,
		PartyTypeID: partyTypeID, InstitutionTypeID: institutionTypeID,
		OwnerEmail: req.OwnerEmail, OwnerName: req.OwnerName, ActorUserID: actorID,
	})
	if err != nil {
		observability.LoggerFrom(r.Context()).Error("provision tenant", "err", err)
		httpapi.WriteJSON(w, http.StatusConflict, `{"error":"could not provision tenant — slug/code may already be taken"}`)
		return
	}
	httpapi.WriteJSONBody(w, http.StatusCreated, map[string]any{
		"tenant": toTenantResponse(result.Tenant), "recovery_link": result.RecoveryLink,
	})
}

// adminTransitionHandler wraps a tenancy status-transition function (SuspendTenant/
// ReactivateTenant/ArchiveTenant — all sharing this exact signature) into an AdminRoute handler,
// so the three routes don't each re-implement the same id/actor parsing + response shape.
func adminTransitionHandler(
	transition func(ctx context.Context, pool *pgxpool.Pool, tenantID, actorID pgtype.UUID) (sqlc.Tenant, error),
) func(w http.ResponseWriter, r *http.Request, d httpapi.Deps, p auth.AuthzPrincipal) {
	return func(w http.ResponseWriter, r *http.Request, d httpapi.Deps, p auth.AuthzPrincipal) {
		id, err := auth.ParseUUID(chi.URLParam(r, "id"))
		if err != nil {
			httpapi.WriteJSON(w, http.StatusBadRequest, `{"error":"bad tenant id"}`)
			return
		}
		actorID, err := auth.ParseUUID(p.ID)
		if err != nil {
			httpapi.WriteJSON(w, http.StatusInternalServerError, `{"error":"bad principal id"}`)
			return
		}
		t, err := transition(r.Context(), d.Pool, id, actorID)
		if err != nil {
			observability.LoggerFrom(r.Context()).Error("tenant transition", "err", err)
			httpapi.WriteJSON(w, http.StatusInternalServerError, `{"error":"internal"}`)
			return
		}
		httpapi.WriteJSONBody(w, http.StatusOK, toTenantResponse(t))
	}
}
