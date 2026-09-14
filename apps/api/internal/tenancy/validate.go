package tenancy

import (
	"errors"
	"net/mail"
	"regexp"
	"strings"

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

// countryPattern is the char(2) ISO shape the countries FK expects.
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

// validateCreateTenant collects everything wrong with the request at once, rather than rejecting the
// first fault and making the caller discover the rest one round-trip at a time.
func validateCreateTenant(req *createTenantRequest) respond.FieldErrors {
	errs := respond.FieldErrors{}

	required := []struct{ field, value string }{
		{"slug", req.Slug}, {"code", req.Code}, {"name", req.Name},
		{"party_type_code", req.PartyTypeCode}, {"institution_type_code", req.InstitutionTypeCode},
		{"owner_email", req.OwnerEmail}, {"owner_name", req.OwnerName},
	}
	for _, r := range required {
		if strings.TrimSpace(r.value) == "" {
			errs.Add(r.field, "is required")
		}
	}

	if req.Slug != "" {
		switch {
		case len(req.Slug) > maxSlugLen:
			errs.Add("slug", "must be at most 63 characters")
		case !slugPattern.MatchString(req.Slug):
			errs.Add("slug", "must be lowercase letters, digits and hyphens, and may not start or end with a hyphen")
		case reservedSlugs[req.Slug]:
			errs.Add("slug", "is reserved by the platform")
		}
	}

	if req.OwnerEmail != "" {
		if _, err := mail.ParseAddress(req.OwnerEmail); err != nil {
			errs.Add("owner_email", "must be a valid email address")
		}
	}

	// country is a char(2) FK to countries; checking the shape here turns what would surface as an
	// opaque FK violation from deep inside provisioning into a field the caller can fix.
	if req.Country != "" && !countryPattern.MatchString(req.Country) {
		errs.Add("country", "must be a 2-letter uppercase ISO country code")
	}

	return errs
}
