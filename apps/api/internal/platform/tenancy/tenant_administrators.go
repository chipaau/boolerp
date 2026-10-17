package tenancy

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// The /api/v1/tenants/{tenantID}/administrators resource (C228, C230): the administrators the
// operator invites to a tenant's Control Centre, the create wizard's step 4. Each is an
// invited membership naming an e-mail, given Control Centre's Administrator in the same
// transaction (C231); it is sent when the tenant is activated and claimed when an account
// verifies the address. The operator adds no one else and no other role: after the
// hand-over the tenant runs its own people. Cerbos decides on the tenant: listing them is
// tenancy:tenant view, inviting and cancelling tenancy:tenant update.

// ErrControlCentreOff is a tenant with Control Centre turned off: its administrators would
// have no app to administer (C204), so none is invited; a 409.
var ErrControlCentreOff = errors.New("tenancy: Control Centre is off for the tenant")

// ErrLastOwner is cancelling the only owner of a tenant past provisioning (C198); a 409.
var ErrLastOwner = errors.New("tenancy: the tenant's last owner")

// administratorJSON is an administrator invitation as the API shows it.
type administratorJSON struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	Name            string     `json:"name"`
	IsOwner         bool       `json:"isOwner"`
	InviteExpiresAt *time.Time `json:"inviteExpiresAt"`
	CreatedAt       time.Time  `json:"createdAt"`
}

func administratorItem(a store.TenantAdministrator) administratorJSON {
	return administratorJSON{a.ID, a.Email, a.Name, a.IsOwner, a.InviteExpiresAt, a.CreatedAt}
}

// administrators answers a tenant's administrator invitations, oldest first (GET
// /api/v1/tenants/{tenantID}/administrators).
func (m *Module) administrators(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "view")
		if !ok {
			return
		}
		l, ok := request.ParseList(w, r, store.TenantAdministratorListSpec)
		if !ok {
			return
		}
		var rows []store.TenantAdministrator
		var total int
		err := tenant.ReadTx(r.Context(), m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
			rows, total, err = store.ListTenantAdministrators(ctx, tx, id, l)
			return err
		})
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing a tenant's administrators failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]administratorJSON, len(rows))
		for i, a := range rows {
			items[i] = administratorItem(a)
		}
		response.Page(w, r, l, items, total)
	}
}

// administratorRequest is POST /api/v1/tenants/{tenantID}/administrators's body (C198,
// C230): the address and name; isOwner marks an owner of the tenant's account.
type administratorRequest struct {
	Email   string `json:"email" validate:"required,max=254,email"`
	Name    string `json:"name" validate:"required,notblank,max=200"`
	IsOwner bool   `json:"isOwner"`
}

// inviteAdministrator invites an administrator to a tenant (POST
// /api/v1/tenants/{tenantID}/administrators): Cerbos decides first (tenancy:tenant update,
// after list). 201 with the invitation and its Location when it is new; 200 with the live
// invitation already made for that address, so sending it again is safe.
func (m *Module) inviteAdministrator(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "update")
		if !ok {
			return
		}
		var req administratorRequest
		if !request.Decode(w, r, &req) {
			return
		}
		a, created, err := m.InviteAdministrator(r.Context(), id, Administrator(req))
		switch {
		case errors.Is(err, ErrControlCentreOff):
			problem.Error(w, r, http.StatusConflict, "Control Centre is off for this tenant: turn it on to invite its administrators.")
		case err != nil:
			m.logger.ErrorContext(r.Context(), "inviting a tenant's administrator failed", "error", err)
			problem.Unavailable(w, r)
		case created:
			response.Created(w, r, "/api/v1/tenants/"+id+"/administrators/"+a.ID, administratorItem(a))
		default:
			response.OK(w, r, administratorItem(a))
		}
	}
}

// cancelAdministrator cancels an administrator invitation (DELETE
// /api/v1/tenants/{tenantID}/administrators/{membershipID}) and its role. Cerbos decides
// first (tenancy:tenant update). 204; 404 when there is no such invitation (or it has been
// claimed: the person is then the tenant's own); 409 for the last owner of a tenant past
// provisioning.
func (m *Module) cancelAdministrator(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "update")
		if !ok {
			return
		}
		cancelled, err := m.CancelAdministrator(r.Context(), id, chi.URLParam(r, "membershipID"))
		switch {
		case errors.Is(err, ErrLastOwner):
			problem.Error(w, r, http.StatusConflict, "This is the tenant's only owner: invite another owner first.")
		case err != nil:
			m.logger.ErrorContext(r.Context(), "cancelling a tenant's administrator failed", "error", err)
			problem.Unavailable(w, r)
		case !cancelled:
			problem.Error(w, r, http.StatusNotFound, "There is no such invitation.")
		default:
			response.NoContent(w, r)
		}
	}
}

// Administrator is an administrator to invite (C228): their address, name, and whether
// they are an owner of the tenant's account (C198).
type Administrator struct {
	Email, Name string
	IsOwner     bool
}

// InviteAdministrator invites a to the tenant and gives the invitation Control Centre's
// Administrator, in one transaction (C231) in the operator's tenant (ctx carries it and the
// actor, who is recorded as inviting); it returns the invitation and whether it is new. The
// address is matched without case or surrounding spaces.
func (m *Module) InviteAdministrator(ctx context.Context, tenantID string, a Administrator) (store.TenantAdministrator, bool, error) {
	var out store.TenantAdministrator
	var created bool
	err := tenant.Tx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
		out, created, err = store.InviteTenantAdministrator(ctx, tx, tenantID, store.NewTenantAdministrator{
			Email: strings.ToLower(strings.TrimSpace(a.Email)), Name: strings.TrimSpace(a.Name), IsOwner: a.IsOwner,
		})
		if err != nil {
			return err
		}
		err = authorization.AssignGlobalRole(ctx, tx, tenantID, out.ID, authorization.ControlCentreAdministrator.Key)
		if errors.Is(err, authorization.ErrAppOff) {
			return ErrControlCentreOff
		}
		return err
	})
	return out, created, err
}

// CancelAdministrator ends the tenant's administrator invitation membershipID and its
// Control Centre role, in one transaction, reporting whether there was one; the tenant's
// last owner past provisioning is ErrLastOwner (checked at commit, C198).
func (m *Module) CancelAdministrator(ctx context.Context, tenantID, membershipID string) (bool, error) {
	var cancelled bool
	err := tenant.Tx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
		if cancelled, err = store.CancelTenantAdministrator(ctx, tx, tenantID, membershipID); err != nil || !cancelled {
			return err
		}
		return authorization.EndGlobalRole(ctx, tx, membershipID, authorization.ControlCentreAdministrator.Key)
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23514" && strings.Contains(pgErr.Message, "without an owner") {
		return false, ErrLastOwner
	}
	return cancelled, err
}
