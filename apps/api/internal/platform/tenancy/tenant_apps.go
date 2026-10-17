package tenancy

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// The /api/v1/tenants/{tenantID}/apps resource (C166, C224): the apps a tenant may have and
// which it has on, which the operator's staff turn on and off in the admin console (what
// the customer bought, D10). Whole apps only, no modules. Cerbos decides on the tenant:
// viewing its apps is tenancy:tenant view, turning them on or off tenancy:tenant update.

// ErrAppUnavailable is an app listed as coming soon (C225): a 409 until it is available.
var ErrAppUnavailable = errors.New("tenancy: app not available yet")

// ErrNoApp is an app the tenant may not have: unknown, retired, or an operator app
// elsewhere; a 404.
var ErrNoApp = errors.New("tenancy: no such app")

// tenantAppJSON is an app as a tenant's list shows it.
type tenantAppJSON struct {
	Key         string     `json:"key"`
	Name        string     `json:"name"`
	Kind        string     `json:"kind"`
	Description *string    `json:"description"`
	IsDefault   bool       `json:"isDefault"`
	IsAvailable bool       `json:"isAvailable"`
	On          bool       `json:"on"`
	ActiveFrom  *time.Time `json:"activeFrom"`
}

func tenantAppItem(a store.TenantApp) tenantAppJSON {
	return tenantAppJSON{a.Key, a.Name, a.Kind, a.Description, a.IsDefault, a.IsAvailable, a.On, a.ActiveFrom}
}

// apps answers the apps a tenant may have, each with whether it is on, the default ones
// first (GET /api/v1/tenants/{tenantID}/apps).
func (m *Module) apps(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "view")
		if !ok {
			return
		}
		l, ok := request.ParseList(w, r, store.TenantAppListSpec)
		if !ok {
			return
		}
		var rows []store.TenantApp
		var total int
		err := tenant.ReadTx(r.Context(), m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
			rows, total, err = store.ListTenantApps(ctx, tx, id, l)
			return err
		})
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing a tenant's apps failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]tenantAppJSON, len(rows))
		for i, a := range rows {
			items[i] = tenantAppItem(a)
		}
		response.Page(w, r, l, items, total)
	}
}

// turnOnApp turns an app on for a tenant (PUT /api/v1/tenants/{tenantID}/apps/{key}):
// Cerbos decides first (tenancy:tenant update, after list, see authorizeTenant). 201 with
// the app and its Location when it was off, 200 when it was already on; 404 for an app the
// tenant may not have, 409 for one coming soon (C225).
func (m *Module) turnOnApp(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "update")
		if !ok {
			return
		}
		key := chi.URLParam(r, "key")
		a, turnedOn, err := m.TurnOnApp(r.Context(), id, key)
		switch {
		case errors.Is(err, ErrNoApp):
			problem.Error(w, r, http.StatusNotFound, "There is no such app for this tenant.")
		case errors.Is(err, ErrAppUnavailable):
			problem.Error(w, r, http.StatusConflict, "This app is coming soon: it cannot be turned on yet.")
		case err != nil:
			m.logger.ErrorContext(r.Context(), "turning on a tenant's app failed", "error", err)
			problem.Unavailable(w, r)
		case turnedOn:
			response.Created(w, r, "/api/v1/tenants/"+id+"/apps/"+key, tenantAppItem(a))
		default:
			response.OK(w, r, tenantAppItem(a))
		}
	}
}

// turnOffApp turns an app off for a tenant (DELETE /api/v1/tenants/{tenantID}/apps/{key}),
// a default app included (C204); turning it on again is a new activation. Cerbos decides
// first (tenancy:tenant update). 204, or 404 when the tenant does not have it on.
func (m *Module) turnOffApp(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "update")
		if !ok {
			return
		}
		off, err := m.TurnOffApp(r.Context(), id, chi.URLParam(r, "key"))
		switch {
		case err != nil:
			m.logger.ErrorContext(r.Context(), "turning off a tenant's app failed", "error", err)
			problem.Unavailable(w, r)
		case !off:
			problem.Error(w, r, http.StatusNotFound, "The tenant does not have this app on.")
		default:
			response.NoContent(w, r)
		}
	}
}

// TurnOnApp turns app key on for a tenant in the operator's transaction (ctx carries the
// operator tenant and the actor, who is recorded as activating it), and returns the app and
// whether it was off. An app the tenant may not have is ErrNoApp; one coming soon,
// ErrAppUnavailable.
func (m *Module) TurnOnApp(ctx context.Context, tenantID, key string) (store.TenantApp, bool, error) {
	var a store.TenantApp
	var turnedOn bool
	err := tenant.Tx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) error {
		app, ok, err := store.TenantAppByKey(ctx, tx, tenantID, key)
		switch {
		case err != nil:
			return err
		case !ok:
			return ErrNoApp
		case !app.IsAvailable && !app.On:
			return ErrAppUnavailable
		}
		if turnedOn, err = store.TurnOnTenantApp(ctx, tx, tenantID, key); err != nil {
			return err
		}
		a, _, err = store.TenantAppByKey(ctx, tx, tenantID, key)
		return err
	})
	return a, turnedOn, err
}

// TurnOffApp turns app key off for a tenant in the operator's transaction, reporting whether
// it had it on.
func (m *Module) TurnOffApp(ctx context.Context, tenantID, key string) (bool, error) {
	var off bool
	err := tenant.Tx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
		off, err = store.TurnOffTenantApp(ctx, tx, tenantID, key)
		return err
	})
	return off, err
}
