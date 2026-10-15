package tenancy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
	// The IANA time zone database inside the binary, so a tenant's time zone is checked
	// the same way whatever the host has installed (the API image has none).
	_ "time/tzdata"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/httpinput"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/adapters/store"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

// The /api/v1/tenants resource: the operator's registry of tenants, which its staff list
// (C179) and create (C197) in the admin console.

// tenantJSON is a tenant as the admin console's routes show it (C179).
type tenantJSON struct {
	ID            string    `json:"id"`
	Slug          string    `json:"slug"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Status        string    `json:"status"`
	Country       string    `json:"country"`
	ParentID      *string   `json:"parentId"`
	ParentName    *string   `json:"parentName"`
	WorkspaceHost *string   `json:"workspaceHost"`
	CreatedAt     time.Time `json:"createdAt"`
}

func tenantItem(t store.TenantItem) tenantJSON {
	return tenantJSON{t.ID, t.Slug, t.Code, t.Name, t.Status, t.Country, t.ParentID, t.ParentName, t.WorkspaceHost, t.CreatedAt}
}

// list answers one page of tenants (GET /api/v1/tenants, C179) for operator staff:
// Cerbos decides first (tenancy:tenant list, which needs tenancy:tenant:view or :manage
// in the operator tenant, C153), then the parameters (C68, C69) are read and the page is
// read in the operator's own transaction.
func (m *Module) list(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "list", "tenancy:tenant"); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		l, ok := httpinput.ParseList(w, r, store.TenantListSpec)
		if !ok {
			return
		}
		var tenants []store.TenantItem
		var total int
		err := tenant.ReadTx(r.Context(), m.db, func(ctx context.Context, tx pgx.Tx) (err error) {
			tenants, total, err = store.ListTenants(ctx, tx, l)
			return err
		})
		if err != nil {
			m.logger.ErrorContext(r.Context(), "listing tenants failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		items := make([]tenantJSON, len(tenants))
		for i, t := range tenants {
			items[i] = tenantItem(t)
		}
		httpinput.WritePage(w, l, items, total)
	}
}

// createRequest is POST /api/v1/tenants's body (C197): step 1 of the admin console's
// wizard. Its tags check the shape; the rules that need data are CreateTenant's.
type createRequest struct {
	Name             string                  `json:"name" validate:"required,max=200"`
	Slug             string                  `json:"slug" validate:"required,max=63"`
	Code             string                  `json:"code" validate:"required,max=10"`
	Country          string                  `json:"country" validate:"required,len=2"`
	LegalFormID      string                  `json:"legalFormId" validate:"required,uuid"`
	Timezone         string                  `json:"timezone" validate:"required,max=64"`
	InstitutionTypes []institutionTypeChoice `json:"institutionTypes" validate:"required,min=1,max=20,dive"`
	ParentID         string                  `json:"parentId" validate:"omitempty,uuid"`
	IdentityNumber   string                  `json:"identityNumber" validate:"omitempty,max=50"`
	RegisteredOn     string                  `json:"registeredOn" validate:"omitempty,datetime=2006-01-02"`
	TaxNumber        string                  `json:"taxNumber" validate:"omitempty,max=50"`
	Email            string                  `json:"email" validate:"omitempty,email,max=254"`
	Phone            string                  `json:"phone" validate:"omitempty,max=16"`
}

type institutionTypeChoice struct {
	Code    string `json:"code" validate:"required,max=50"`
	Primary bool   `json:"primary"`
}

// create creates a tenant in provisioning (POST /api/v1/tenants, C197) for the operator's
// staff: Cerbos decides first (tenancy:tenant create, which needs tenancy:tenant:manage in
// the operator tenant, C153), then the body is read, and CreateTenant checks its rules and
// writes it. 201 with the tenant as the list shows it and its address in Location.
func (m *Module) create(authz authorization.Authorizer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := authz.Can(r.Context(), "create", "tenancy:tenant"); err != nil {
			authorization.WriteError(w, r, err)
			return
		}
		var req createRequest
		if !httpinput.Decode(w, r, &req) {
			return
		}
		n := NewTenant{
			Name: strings.TrimSpace(req.Name), Slug: req.Slug, Code: req.Code, Country: req.Country,
			LegalFormID: req.LegalFormID, Timezone: req.Timezone, ParentID: req.ParentID,
			IdentityNumber: strings.TrimSpace(req.IdentityNumber), TaxNumber: strings.TrimSpace(req.TaxNumber),
			Email: strings.TrimSpace(req.Email), Phone: req.Phone,
		}
		if req.RegisteredOn != "" {
			on, _ := time.Parse(time.DateOnly, req.RegisteredOn) // its format is checked above
			n.RegisteredOn = &on
		}
		for _, it := range req.InstitutionTypes {
			n.InstitutionTypes = append(n.InstitutionTypes, InstitutionTypeChoice(it))
		}
		t, err := m.CreateTenant(r.Context(), n)
		var invalid *problem.ValidationError
		switch {
		case errors.As(err, &invalid):
			problem.WriteValidation(w, r, invalid.Errors)
			return
		case err != nil:
			m.logger.ErrorContext(r.Context(), "creating a tenant failed", "error", err)
			problem.Unavailable(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Location", "/api/v1/tenants/"+t.ID)
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(tenantItem(t))
	}
}

// Reference is what creating a tenant needs from the reference lists (C134: another
// module's data comes through its owner): whether a country, a legal form, and
// institution types are current, and which identity document a legal form names. The
// edition passes the reference module. The database's foreign keys still guard that each
// exists and that the legal form is of the tenant's country.
type Reference interface {
	// CountryCurrent reports whether code is a country in use.
	CountryCurrent(ctx context.Context, code string) (bool, error)
	// LegalForm returns a current legal form's country and the identity document it
	// names ("" for none); ok is false when there is no such current form.
	LegalForm(ctx context.Context, id string) (country, identityDocument string, ok bool, err error)
	// InstitutionTypesCurrent returns which of codes are current institution types.
	InstitutionTypesCurrent(ctx context.Context, codes []string) (map[string]bool, error)
}

// NewTenant is what creating a tenant takes (C197): step 1 of the admin console's
// wizard. Optional fields are empty when not given.
type NewTenant struct {
	Name, Slug, Code, Country, LegalFormID, Timezone  string
	InstitutionTypes                                  []InstitutionTypeChoice
	ParentID, IdentityNumber, TaxNumber, Email, Phone string
	RegisteredOn                                      *time.Time
}

// InstitutionTypeChoice is one of a new tenant's institution types; exactly one is primary.
type InstitutionTypeChoice struct {
	Code    string
	Primary bool
}

// Created is the tenant creating made.
type Created = store.TenantItem

var (
	slugPattern  = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)
	codePattern  = regexp.MustCompile(`^[A-Z0-9]{2,10}$`)
	phonePattern = regexp.MustCompile(`^\+[0-9]{6,15}$`)
	// Names the platform uses itself, as the tenants table's CHECK lists them.
	reservedSlugs = map[string]bool{"admin": true, "api": true, "app": true, "auth": true, "identity": true,
		"login": true, "www": true, "mail": true, "smtp": true, "imap": true, "ftp": true, "oidc": true,
		"static": true, "assets": true, "cdn": true, "status": true, "docs": true, "help": true,
		"support": true, "billing": true, "bool": true, "operator": true, "root": true, "system": true}
)

// CreateTenant creates a tenant in provisioning (C197) for the operator's staff, in the
// operator's transaction (ctx carries the operator tenant and the actor): the tenant, its
// institution types with the primary, and the default apps (C204), all or nothing. It has
// no domain until it is activated (C203) and no owner until one is added (C198). A rule the
// request breaks is a *problem.ValidationError naming each field (C71); a slug, code,
// identity number, or tax number another tenant holds names that tenant.
func (m *Module) CreateTenant(ctx context.Context, n NewTenant) (Created, error) {
	errs, err := m.checkNewTenant(ctx, n)
	if err != nil {
		return Created{}, err
	}
	if len(errs) > 0 {
		return Created{}, &problem.ValidationError{Errors: errs}
	}
	var created Created
	err = tenant.Tx(ctx, m.db, func(ctx context.Context, tx pgx.Tx) error {
		errs, err := taken(ctx, tx, n)
		if err != nil {
			return err
		}
		if len(errs) > 0 {
			return &problem.ValidationError{Errors: errs}
		}
		if n.ParentID != "" {
			ok, err := store.ParentAllowed(ctx, tx, n.ParentID)
			if err != nil {
				return err
			}
			if !ok {
				return invalid("parentId", "exists", "is not a tenant that can be a parent")
			}
		}
		id, err := store.InsertTenant(ctx, tx, store.NewTenant{
			Name: n.Name, Slug: n.Slug, Code: n.Code, Country: n.Country, LegalFormID: n.LegalFormID,
			Timezone: n.Timezone, ParentID: n.ParentID, IdentityNumber: n.IdentityNumber,
			RegisteredOn: n.RegisteredOn, TaxNumber: n.TaxNumber, Email: n.Email, Phone: n.Phone,
		})
		if err != nil {
			return uniqueViolation(err)
		}
		for _, it := range n.InstitutionTypes {
			if err := store.InsertInstitutionType(ctx, tx, id, it.Code, it.Primary); err != nil {
				return err
			}
		}
		if err := store.TurnOnDefaultApps(ctx, tx, id); err != nil {
			return err
		}
		created, err = store.TenantByID(ctx, tx, id)
		return err
	})
	return created, err
}

// checkNewTenant checks what can be checked before the transaction: the formats the
// table would refuse, and the reference rules (C136, C197).
func (m *Module) checkNewTenant(ctx context.Context, n NewTenant) ([]problem.FieldError, error) {
	var errs []problem.FieldError
	add := func(field, code, detail string) {
		errs = append(errs, problem.FieldError{Pointer: "#/" + field, Code: code, Detail: detail})
	}
	switch {
	case !slugPattern.MatchString(n.Slug):
		add("slug", "format", "must be 3 to 63 lowercase letters, digits, and hyphens, not starting or ending with a hyphen")
	case reservedSlugs[n.Slug]:
		add("slug", "reserved", "is a name the platform uses")
	}
	if !codePattern.MatchString(n.Code) {
		add("code", "format", "must be 2 to 10 capital letters and digits")
	}
	if strings.TrimSpace(n.Name) == "" {
		add("name", "required", "is required")
	}
	if n.Phone != "" && !phonePattern.MatchString(n.Phone) {
		add("phone", "format", "must be in international form: + and 6 to 15 digits")
	}
	if n.Timezone == "Local" || n.Timezone == "" {
		add("timezone", "timezone", "must be an IANA time zone, such as Indian/Maldives")
	} else if _, err := time.LoadLocation(n.Timezone); err != nil {
		add("timezone", "timezone", "must be an IANA time zone, such as Indian/Maldives")
	}
	errs = append(errs, checkInstitutionTypes(n.InstitutionTypes)...)
	ref, err := m.checkReference(ctx, n)
	return append(errs, ref...), err
}

// checkInstitutionTypes requires one or more distinct types, exactly one of them primary (C138).
func checkInstitutionTypes(types []InstitutionTypeChoice) []problem.FieldError {
	var errs []problem.FieldError
	seen, primaries := map[string]bool{}, 0
	for i, it := range types {
		if seen[it.Code] {
			errs = append(errs, problem.FieldError{Pointer: fmt.Sprintf("#/institutionTypes/%d/code", i), Code: "unique", Detail: "is listed twice"})
		}
		seen[it.Code] = true
		if it.Primary {
			primaries++
		}
	}
	if len(types) > 0 && primaries != 1 {
		errs = append(errs, problem.FieldError{Pointer: "#/institutionTypes", Code: "primary", Detail: "must mark exactly one type as primary"})
	}
	return errs
}

// checkReference checks the request against the reference lists: a current country, a
// current legal form of that country, the identity number its document needs (required
// when it names one, refused when it names none), and current institution types.
func (m *Module) checkReference(ctx context.Context, n NewTenant) ([]problem.FieldError, error) {
	var errs []problem.FieldError
	add := func(field, code, detail string) {
		errs = append(errs, problem.FieldError{Pointer: "#/" + field, Code: code, Detail: detail})
	}
	ok, err := m.reference.CountryCurrent(ctx, n.Country)
	if err != nil {
		return nil, err
	}
	if !ok {
		add("country", "exists", "is not a country in use")
	}
	country, document, ok, err := m.reference.LegalForm(ctx, n.LegalFormID)
	if err != nil {
		return nil, err
	}
	switch {
	case !ok:
		add("legalFormId", "exists", "is not a legal form in use")
	case country != n.Country:
		add("legalFormId", "country", "is not a legal form of the tenant's country")
	case document != "" && strings.TrimSpace(n.IdentityNumber) == "":
		add("identityNumber", "required", "is required: the legal form names a "+strings.ToLower(document))
	case document == "" && n.IdentityNumber != "":
		add("identityNumber", "excluded", "is not taken: the legal form names no identity document")
	}
	codes := make([]string, len(n.InstitutionTypes))
	for i, it := range n.InstitutionTypes {
		codes[i] = it.Code
	}
	current, err := m.reference.InstitutionTypesCurrent(ctx, codes)
	if err != nil {
		return nil, err
	}
	for i, c := range codes {
		if !current[c] {
			add(fmt.Sprintf("institutionTypes/%d/code", i), "exists", "is not an institution type in use")
		}
	}
	return errs, nil
}

// taken names, for each unique value another tenant already holds, the tenant holding it.
func taken(ctx context.Context, tx pgx.Tx, n NewTenant) ([]problem.FieldError, error) {
	var errs []problem.FieldError
	for _, c := range []struct{ field, column, value string }{
		{"slug", "slug", n.Slug}, {"code", "code", n.Code},
		{"identityNumber", "identity_number", n.IdentityNumber}, {"taxNumber", "tax_number", n.TaxNumber},
	} {
		if c.value == "" {
			continue
		}
		name, ok, err := store.HolderOf(ctx, tx, c.column, c.value, n.Country)
		if err != nil {
			return nil, err
		}
		if ok {
			errs = append(errs, problem.FieldError{Pointer: "#/" + c.field, Code: "unique", Detail: "is already used by " + name})
		}
	}
	return errs, nil
}

func invalid(field, code, detail string) error {
	return &problem.ValidationError{Errors: []problem.FieldError{{Pointer: "#/" + field, Code: code, Detail: detail}}}
}

// uniqueViolation turns a unique violation that slipped past taken (another request
// creating the same value at once) into the field's error.
func uniqueViolation(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return err
	}
	field := map[string]string{"tenants_slug_key": "slug", "tenants_code_key": "code",
		"tenants_identity_number": "identityNumber", "tenants_tax_number": "taxNumber"}[pgErr.ConstraintName]
	if field == "" {
		return err
	}
	return invalid(field, "unique", "is already used by another tenant")
}
