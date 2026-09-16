package tenancy

import (
	"errors"
	"regexp"

	validation "github.com/go-ozzo/ozzo-validation/v4"
	"github.com/go-ozzo/ozzo-validation/v4/is"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/boolmv/erp/internal/respond"
)

// uniqueViolationField maps a Postgres unique-constraint violation onto the request field that
// caused it, so a duplicate is reported as that field's problem rather than a generic conflict.
// Returns "" when err isn't a unique violation (or is one we can't attribute), leaving the caller to
// treat it as a genuine failure instead of blaming the caller for it.
func uniqueViolationField(err error) string {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return ""
	}
	switch pgErr.ConstraintName {
	case "tenants_slug_key":
		return "slug"
	case "tenants_code_key":
		return "code"
	case "users_email_key":
		// The owner identity is created as part of provisioning, so a pre-existing user with that
		// address fails here — a likely operator mistake, and previously indistinguishable from a
		// duplicate tenant slug.
		return "owner_email"
	}
	return ""
}

// slugPattern is a DNS label: lowercase alphanumerics and hyphens, no leading or trailing hyphen.
// The slug IS the tenant's subdomain — it's rendered into <slug>.bool.mv and parsed back out of the
// Host header by slugFromHost — so anything the routing regexp can't match produces a tenant that
// is created successfully and then simply unreachable, with nothing to explain why.
var slugPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)

// maxSlugLen is the DNS label limit; a longer slug can't be a hostname.
const maxSlugLen = 63

// countryPattern is the char(2) ISO shape the countries FK expects. Shape only — whether the code
// names a real, still-active country is checked against the countries table in the handler, since
// "ZZ" satisfies this pattern and is not a country.
var countryPattern = regexp.MustCompile(`^[A-Z]{2}$`)

// reservedSlugs are subdomains the platform itself serves, so no tenant may take one. A tenant
// holding one of these is unreachable (the fixed-host router wins on priority), and the reverse is
// worse: adding a new platform host later would silently break a live tenant that already owns that
// name. Keep in step with the fixed Host() routers in compose.yaml and the production equivalent.
// Slugs are immutable after go-live, so a wrong one here is expensive to undo.
var reservedSlugs = map[string]bool{
	"admin": true, "api": true, "app": true, "www": true, "website": true, "mail": true,
	"auth": true, "kratos": true, "cerbos": true, "static": true, "assets": true, "cdn": true,
	"grafana": true, "prometheus": true, "loki": true, "tempo": true, "promtail": true,
	"status": true, "docs": true, "support": true, "help": true,
}

// notReserved rejects a slug the platform itself serves. A domain rule, so it's a plain Go func
// rather than anything the rule vocabulary could express.
var notReserved = validation.By(func(value any) error {
	if slug, _ := value.(string); reservedSlugs[slug] {
		return errors.New("is reserved by the platform")
	}
	return nil
})

// validateCreateTenant reports everything wrong with the request at once, rather than rejecting the
// first fault and making the caller discover the rest one round-trip at a time.
//
// Strings arrive already trimmed — httpapi.SanitizeBody does that for every route — so Required
// correctly treats a whitespace-only field as absent rather than present-but-blank.
//
// ozzo states rules as ordinary Go against real struct fields — no tags — so a renamed field is a
// compile error rather than a rule that silently stops running, and a domain rule like notReserved
// is just a func. Rules that need the database (does this country exist, is this institution type
// valid for it) stay in the handler: they need a querier, and validation here is pure.
func validateCreateTenant(req *createTenantRequest) respond.FieldErrors {
	err := validation.ValidateStruct(req,
		validation.Field(&req.Slug,
			validation.Required,
			validation.Length(1, maxSlugLen),
			validation.Match(slugPattern).Error("must be lowercase letters, digits and hyphens, and may not start or end with a hyphen"),
			notReserved,
		),
		validation.Field(&req.Code, validation.Required),
		validation.Field(&req.Name, validation.Required),
		validation.Field(&req.Country, validation.Required,
			validation.Match(countryPattern).Error("must be a 2-letter uppercase ISO country code")),
		validation.Field(&req.PartyTypeCode, validation.Required),
		validation.Field(&req.InstitutionTypeCode, validation.Required),
		validation.Field(&req.OwnerEmail, validation.Required, is.EmailFormat),
		validation.Field(&req.OwnerName, validation.Required),
	)
	return toFieldErrors(err)
}

// toFieldErrors converts ozzo's field -> error map into the response shape (respond.Invalid writes
// it as Laravel's field -> messages). Field names come from the json tags, so what the caller is
// told to fix matches what they sent. A non-validation error would mean the rules themselves are
// broken, so it surfaces as an unattributed message rather than being silently dropped.
func toFieldErrors(err error) respond.FieldErrors {
	errs := respond.FieldErrors{}
	if err == nil {
		return errs
	}
	var verrs validation.Errors
	if !errors.As(err, &verrs) {
		errs.Add("_", err.Error())
		return errs
	}
	for field, fieldErr := range verrs {
		errs.Add(field, fieldErr.Error())
	}
	return errs
}
