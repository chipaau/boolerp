package tenancy

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/response"
	"github.com/boolmv/erp/apps/api/internal/platform/reference"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// The /api/v1/tenants/{tenantID}/addresses resource (C215, C217): a tenant's registered
// address (printed on invoices, C172) and, when it differs, its mailing address, which the
// operator's staff keep in the admin console. Cerbos decides on the tenant: viewing its
// addresses is tenancy:tenant view, changing them tenancy:tenant update.

// addressKinds are the addresses a tenant may have, as the table's CHECK lists them.
var addressKinds = map[string]bool{"registered": true, "mailing": true}

// errNoTenant is a tenant the operator's transaction does not see: a 404.
var errNoTenant = errors.New("tenancy: no such tenant")

// addressJSON is an address as the API shows it: its places from level 1 down to the one
// picked, the levels typed, and the street part.
type addressJSON struct {
	Kind        string                `json:"kind"`
	Country     string                `json:"country"`
	GeographyID *string               `json:"geographyId"`
	Places      []reference.Geography `json:"places"`
	TypedPlaces map[string]string     `json:"typedPlaces"`
	Line1       string                `json:"line1"`
	Line2       *string               `json:"line2"`
	PostalCode  *string               `json:"postalCode"`
	Latitude    *float64              `json:"latitude"`
	Longitude   *float64              `json:"longitude"`
	UpdatedAt   time.Time             `json:"updatedAt"`
}

func (m *Module) addressJSON(ctx context.Context, a store.TenantAddress) (addressJSON, error) {
	out := addressJSON{Kind: a.Kind, Country: a.Country, GeographyID: a.GeographyID, Places: []reference.Geography{},
		TypedPlaces: a.TypedPlaces, Line1: a.Line1, Line2: a.Line2, PostalCode: a.Postcode,
		Latitude: a.Latitude, Longitude: a.Longitude, UpdatedAt: a.UpdatedAt}
	if a.GeographyID != nil {
		path, err := m.reference.PlacePath(ctx, *a.GeographyID)
		if err != nil {
			return out, err
		}
		out.Places = path
	}
	return out, nil
}

// authorizeTenant asks Cerbos whether the caller may know of tenants at all (tenancy:tenant
// list, which viewing and managing them imply), so a 404 tells only them which exist; then
// reads the tenant the request names in the operator's transaction and asks whether the
// caller may act on it. It writes the refusal, or a 404 for a tenant there is none of, and
// reports whether the request may go on.
func (m *Module) authorizeTenant(w http.ResponseWriter, r *http.Request, authz authorization.Authorizer, action string) (string, bool) {
	if err := authz.Can(r.Context(), "list", tenantKind); err != nil {
		authorization.WriteError(w, r, m.logger, err)
		return "", false
	}
	id := chi.URLParam(r, "tenantID")
	var status string
	err := tenant.ReadTx(r.Context(), m.db, func(ctx context.Context, tx pgx.Tx) error {
		s, ok, err := store.TenantStatus(ctx, tx, id)
		if err == nil && !ok {
			return errNoTenant
		}
		status = s
		return err
	})
	switch {
	case errors.Is(err, errNoTenant):
		problem.Error(w, r, http.StatusNotFound, "There is no such tenant.")
		return "", false
	case err != nil:
		m.logger.ErrorContext(r.Context(), "reading a tenant failed", "error", err)
		problem.Unavailable(w, r)
		return "", false
	}
	if err := authz.Check(r.Context(), action, authorization.Resource{
		Kind: tenantKind, ID: id, Attributes: map[string]any{"tenant_id": id, "status": status},
	}); err != nil {
		authorization.WriteError(w, r, m.logger, err)
		return "", false
	}
	return id, true
}

// addressKind reads the address kind the path names, writing a 404 for any other.
func addressKind(w http.ResponseWriter, r *http.Request) (string, bool) {
	kind := chi.URLParam(r, "kind")
	if !addressKinds[kind] {
		problem.Error(w, r, http.StatusNotFound, "A tenant has a registered and a mailing address, nothing else.")
		return "", false
	}
	return kind, true
}

// addresses answers a tenant's addresses, registered first (GET /api/v1/tenants/{tenantID}/addresses).
func (m *Module) addresses(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "view")
		if !ok {
			return
		}
		l, ok := request.ParseList(w, r, store.TenantAddressListSpec)
		if !ok {
			return
		}
		var rows []store.TenantAddress
		var total int
		err := tenant.ReadTx(r.Context(), m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
			rows, total, err = store.ListTenantAddresses(ctx, tx, id, l)
			return err
		})
		items := make([]addressJSON, len(rows))
		for i := 0; err == nil && i < len(rows); i++ {
			items[i], err = m.addressJSON(r.Context(), rows[i])
		}
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing a tenant's addresses failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		response.Page(w, r, l, items, total)
	}
}

// addressRequest is PUT /api/v1/tenants/{tenantID}/addresses/{kind}'s body: the whole
// address. The request holds the rules that need no data (C208); its places are checked
// against the country's levels by SetAddress.
type addressRequest struct {
	Country     string            `json:"country" validate:"required,len=2,uppercase"`
	GeographyID string            `json:"geographyId" validate:"omitempty,uuid"`
	TypedPlaces map[string]string `json:"typedPlaces" validate:"max=9,dive,keys,min=2,max=50,endkeys,required,notblank,max=200"`
	Line1       string            `json:"line1" validate:"required,notblank,max=200"`
	Line2       string            `json:"line2" validate:"omitempty,notblank,max=200"`
	PostalCode  string            `json:"postalCode" validate:"omitempty,notblank,max=20"`
	Latitude    *float64          `json:"latitude" validate:"omitnil,min=-90,max=90"`
	Longitude   *float64          `json:"longitude" validate:"omitnil,min=-180,max=180"`
}

func init() { request.RegisterStructValidation(validateAddressRequest, addressRequest{}) }

// validateAddressRequest checks that a point has both its latitude and its longitude, as
// the table's CHECK does.
func validateAddressRequest(sl validator.StructLevel) {
	req := sl.Current().Interface().(addressRequest)
	switch {
	case req.Latitude != nil && req.Longitude == nil:
		sl.ReportError(req.Longitude, "longitude", "Longitude", "required_with", "latitude")
	case req.Latitude == nil && req.Longitude != nil:
		sl.ReportError(req.Latitude, "latitude", "Latitude", "required_with", "longitude")
	}
}

// setAddress adds or replaces a tenant's address of a kind (PUT
// /api/v1/tenants/{tenantID}/addresses/{kind}): Cerbos decides first (tenancy:tenant
// update, after list, see authorizeTenant), then the body is read, and SetAddress checks its
// places and writes it. 201 with
// the address and its Location when it is new, 200 when it replaced one.
func (m *Module) setAddress(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "update")
		if !ok {
			return
		}
		kind, ok := addressKind(w, r)
		if !ok {
			return
		}
		var req addressRequest
		if !request.Decode(w, r, &req) {
			return
		}
		typed := make(map[string]string, len(req.TypedPlaces))
		for code, name := range req.TypedPlaces {
			typed[code] = strings.TrimSpace(name)
		}
		a, created, err := m.SetAddress(r.Context(), id, Address{
			Kind: kind, Country: req.Country, GeographyID: req.GeographyID, TypedPlaces: typed,
			Line1: strings.TrimSpace(req.Line1), Line2: strings.TrimSpace(req.Line2),
			PostalCode: strings.TrimSpace(req.PostalCode), Latitude: req.Latitude, Longitude: req.Longitude,
		})
		var invalid *problem.ValidationError
		switch {
		case errors.As(err, &invalid):
			problem.WriteValidation(w, r, invalid.Errors)
			return
		case err != nil:
			m.logger.ErrorContext(r.Context(), "setting a tenant's address failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		out, err := m.addressJSON(r.Context(), a)
		if err != nil {
			m.logger.ErrorContext(r.Context(), "reading an address's places failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		if created {
			response.Created(w, r, "/api/v1/tenants/"+id+"/addresses/"+kind, out)
			return
		}
		response.OK(w, r, out)
	}
}

// removeAddress removes a tenant's address of a kind (DELETE
// /api/v1/tenants/{tenantID}/addresses/{kind}): removing the mailing address sends mail to
// the registered one. Cerbos decides first (tenancy:tenant update). 204, or 404 when the
// tenant has no such address.
func (m *Module) removeAddress(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := m.authorizeTenant(w, r, authz, "update")
		if !ok {
			return
		}
		kind, ok := addressKind(w, r)
		if !ok {
			return
		}
		removed, err := m.RemoveAddress(r.Context(), id, kind)
		switch {
		case err != nil:
			m.logger.ErrorContext(r.Context(), "removing a tenant's address failed", "error", err)
			problem.Unavailable(w, r)
		case !removed:
			problem.Error(w, r, http.StatusNotFound, "The tenant has no "+kind+" address.")
		default:
			response.NoContent(w, r)
		}
	}
}

// Address is a tenant's address to set (C215): its kind (registered or mailing), its
// country, the deepest place picked ("" for none), the levels typed by type code, and the
// street part. Optional fields are empty when not given.
type Address struct {
	Kind, Country, GeographyID string
	TypedPlaces                map[string]string
	Line1, Line2, PostalCode   string
	Latitude, Longitude        *float64
}

// SetAddress adds or replaces a tenant's address of a kind, in the operator's transaction
// (ctx carries the operator tenant and the actor), and returns it and whether it is new. Its
// places are checked against the country's levels first (reference.CheckAddress), so a
// caller other than HTTP is held to them too; a rule broken is a *problem.ValidationError.
func (m *Module) SetAddress(ctx context.Context, tenantID string, a Address) (store.TenantAddress, bool, error) {
	if !addressKinds[a.Kind] {
		return store.TenantAddress{}, false, problem.Invalid("kind", "oneof", "must be registered or mailing")
	}
	if err := m.reference.CheckAddress(ctx, a.Country, a.GeographyID, a.TypedPlaces); err != nil {
		return store.TenantAddress{}, false, err
	}
	var out store.TenantAddress
	var created bool
	err := tenant.Tx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
		out, created, err = store.SetTenantAddress(ctx, tx, tenantID, store.NewTenantAddress{
			Kind: a.Kind, Country: a.Country, GeographyID: a.GeographyID, TypedPlaces: a.TypedPlaces,
			Line1: a.Line1, Line2: a.Line2, Postcode: a.PostalCode, Latitude: a.Latitude, Longitude: a.Longitude,
		})
		return err
	})
	return out, created, err
}

// RemoveAddress removes a tenant's address of a kind in the operator's transaction,
// reporting whether it had one.
func (m *Module) RemoveAddress(ctx context.Context, tenantID, kind string) (bool, error) {
	var removed bool
	err := tenant.Tx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
		removed, err = store.DeleteTenantAddress(ctx, tx, tenantID, kind)
		return err
	})
	return removed, err
}
