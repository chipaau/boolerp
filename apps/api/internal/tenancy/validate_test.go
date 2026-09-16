package tenancy

import "testing"

func TestValidateCreateTenant(t *testing.T) {
	valid := func() createTenantRequest {
		return createTenantRequest{
			Slug: "malecouncil", Code: "MCC", Name: "Male City Council", Country: "MV",
			PartyTypeCode: "government", InstitutionTypeCode: "council",
			OwnerEmail: "owner@malecouncil.mv", OwnerName: "Owner",
		}
	}

	for _, tc := range []struct {
		name      string
		mutate    func(*createTenantRequest)
		wantField string
	}{
		{"accepts a valid request", func(*createTenantRequest) {}, ""},
		{"accepts hyphens inside the slug", func(r *createTenantRequest) { r.Slug = "male-city-council" }, ""},
		{"accepts digits in the slug", func(r *createTenantRequest) { r.Slug = "council2" }, ""},

		{"rejects a missing slug", func(r *createTenantRequest) { r.Slug = "" }, "slug"},
		{"rejects a whitespace-only name", func(r *createTenantRequest) { r.Name = "   " }, "name"},
		{"rejects uppercase in the slug", func(r *createTenantRequest) { r.Slug = "MaleCouncil" }, "slug"},
		{"rejects spaces in the slug", func(r *createTenantRequest) { r.Slug = "male council" }, "slug"},
		{"rejects non-ascii in the slug", func(r *createTenantRequest) { r.Slug = "malé" }, "slug"},
		{"rejects an underscore in the slug", func(r *createTenantRequest) { r.Slug = "male_council" }, "slug"},
		{"rejects a leading hyphen", func(r *createTenantRequest) { r.Slug = "-council" }, "slug"},
		{"rejects a trailing hyphen", func(r *createTenantRequest) { r.Slug = "council-" }, "slug"},
		{"rejects a slug over the DNS label limit", func(r *createTenantRequest) {
			r.Slug = "a123456789012345678901234567890123456789012345678901234567890123"
		}, "slug"},

		// A tenant holding a platform subdomain is created fine and then unreachable.
		{"rejects a reserved slug", func(r *createTenantRequest) { r.Slug = "admin" }, "slug"},
		{"rejects an observability-host slug", func(r *createTenantRequest) { r.Slug = "grafana" }, "slug"},

		{"rejects a malformed owner email", func(r *createTenantRequest) { r.OwnerEmail = "not-an-email" }, "owner_email"},
		{"rejects a lowercase country code", func(r *createTenantRequest) { r.Country = "mv" }, "country"},
		{"rejects a 3-letter country code", func(r *createTenantRequest) { r.Country = "MDV" }, "country"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := valid()
			tc.mutate(&req)
			errs := validateCreateTenant(&req)

			if tc.wantField == "" {
				if errs.Any() {
					t.Fatalf("want no validation errors, got %v", errs)
				}
				return
			}
			if len(errs[tc.wantField]) == 0 {
				t.Fatalf("want an error on %q, got %v", tc.wantField, errs)
			}
		})
	}
}

// Every problem is reported at once, so a caller fixes one round-trip's worth rather than
// discovering the next fault only after correcting the last.
func TestValidateCreateTenant_ReportsEveryFieldAtOnce(t *testing.T) {
	errs := validateCreateTenant(&createTenantRequest{Slug: "Bad Slug", Country: "mv", OwnerEmail: "nope"})

	for _, field := range []string{"slug", "code", "name", "party_type_code", "institution_type_code", "owner_email", "owner_name", "country"} {
		if len(errs[field]) == 0 {
			t.Errorf("want an error reported for %q, got none", field)
		}
	}
}

// ozzo's Required sees any non-empty string as present, so "   " would pass a bare Required check.
// Fields are trimmed before validating, which also keeps surrounding whitespace out of the database
// since the handler provisions from this same struct.
func TestValidateCreateTenant_TrimsAndRejectsWhitespaceOnly(t *testing.T) {
	req := createTenantRequest{
		Slug: "  malecouncil  ", Code: " MCC ", Name: "   ", Country: " MV ",
		PartyTypeCode: " government ", InstitutionTypeCode: " council ",
		OwnerEmail: "  owner@malecouncil.mv  ", OwnerName: " Owner ",
	}
	errs := validateCreateTenant(&req)

	if len(errs["name"]) == 0 {
		t.Fatalf("want a whitespace-only name rejected, got %v", errs)
	}
	for field, msgs := range errs {
		if field != "name" {
			t.Fatalf("only name should fail; %q also did: %v", field, msgs)
		}
	}
	// Normalisation is visible to the caller: these values are what get provisioned.
	if req.Slug != "malecouncil" || req.Code != "MCC" || req.Country != "MV" || req.OwnerEmail != "owner@malecouncil.mv" {
		t.Fatalf("want fields trimmed in place, got %+v", req)
	}
}
