package seeds

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/seed"
)

//go:embed sample_tenants.csv
var sampleTenantsCSV []byte

// Sample is one row of sample_tenants.csv: a tenant, its legal form by code in its
// country, its time zone, its parent by slug, and its types, the primary first. No
// types means still provisioning.
type Sample struct {
	Slug, Code, Name, Country, LegalForm, Timezone, IdentityNumber, Parent string
	Types                                                                  []string
}

// ParseSamples reads sample tenants CSV. It rejects a malformed row, a repeated
// slug, a parent that is not an earlier row, and a row without a legal form or time
// zone (C195).
func ParseSamples(data []byte) ([]Sample, error) {
	r := csv.NewReader(bytes.NewReader(data))
	r.Comment = '#'
	r.FieldsPerRecord = 9
	header, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("sample tenants header: %w", err)
	}
	if strings.Join(header, ",") != "slug,code,name,country,legal_form,timezone,identity_number,parent,types" {
		return nil, fmt.Errorf("sample tenants header: got %q", header)
	}
	var samples []Sample
	seen := map[string]bool{}
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			return samples, nil
		}
		if err != nil {
			return nil, fmt.Errorf("sample tenants: %w", err)
		}
		s := Sample{Slug: rec[0], Code: rec[1], Name: rec[2], Country: rec[3], LegalForm: rec[4],
			Timezone: rec[5], IdentityNumber: rec[6], Parent: rec[7]}
		if rec[8] != "" {
			s.Types = strings.Split(rec[8], "|")
		}
		switch {
		case s.Slug == "" || s.Code == "" || strings.TrimSpace(s.Name) == "" || s.Country == "":
			return nil, fmt.Errorf("sample tenants: a row without slug, code, name, or country")
		case seen[s.Slug]:
			return nil, fmt.Errorf("sample tenants: duplicate %s", s.Slug)
		case s.Parent != "" && !seen[s.Parent]:
			return nil, fmt.Errorf("sample tenants %s: parent %s is not an earlier row", s.Slug, s.Parent)
		case s.LegalForm == "" || s.Timezone == "":
			return nil, fmt.Errorf("sample tenants %s: a legal form and time zone are required", s.Slug)
		}
		seen[s.Slug] = true
		samples = append(samples, s)
	}
}

// SampleSlugs are the embedded sample tenants' slugs, for other modules' sample seeds.
func SampleSlugs() []string {
	samples, err := ParseSamples(sampleTenantsCSV)
	if err != nil {
		panic(err) // the embedded list is checked by its tests
	}
	slugs := make([]string, len(samples))
	for i, s := range samples {
		slugs[i] = s.Slug
	}
	return slugs
}

// Samples creates the sample tenants, in development only (C143). It writes as
// the table owner, like Operator: tenancy has no create-tenant operation yet, so
// this is a recorded exception to seeding through use cases (C50) until it does.
// A tenant whose slug exists is left as it is.
// Each sample, new or existing, gets its platform workspace host,
// <slug>.<platform domain>, if it has none (C158, C159).
type Samples struct {
	db             DB
	data           []byte
	platformDomain string
}

// NewSamples returns the seeder over db, with the embedded list.
func NewSamples(db DB, platformDomain string) *Samples {
	return NewSamplesFrom(db, sampleTenantsCSV, platformDomain)
}

// NewSamplesFrom returns the seeder over db with another list in the same format
// (tests use their own test country and types).
func NewSamplesFrom(db DB, data []byte, platformDomain string) *Samples {
	return &Samples{db: db, data: data, platformDomain: platformDomain}
}

// Name implements seed.Seeder.
func (*Samples) Name() string { return "tenancy.sample_tenants" }

// Run implements seed.Seeder, in one transaction: the rule that an active tenant
// has a primary type is checked at its commit.
func (s *Samples) Run(ctx context.Context, env seed.Env) error {
	if env.Environment != "dev" {
		env.Logger.InfoContext(ctx, "sample tenants are seeded only in dev; skipped")
		return nil
	}
	samples, err := ParseSamples(s.data)
	if err != nil {
		return err
	}
	var created, existing, domains int
	// One transaction, attributed to the seeder in the audit (C164).
	err = actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		for _, sm := range samples {
			var id string
			err := tx.QueryRow(ctx, `SELECT id FROM tenants WHERE slug = $1`, sm.Slug).Scan(&id)
			switch {
			case err == nil:
				existing++
			case errors.Is(err, pgx.ErrNoRows):
				if id, err = createSample(ctx, tx, sm); err != nil {
					return err
				}
				created++
			default:
				return fmt.Errorf("sample %s: %w", sm.Slug, err)
			}
			added, err := ensurePlatformDomain(ctx, tx, id, sm.Slug, s.platformDomain)
			if err != nil {
				return err
			}
			if added {
				domains++
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "sample tenants seeded", "created", created, "existing", existing, "domains", domains)
	return nil
}

// createSample inserts a sample tenant and its institution types, returning its id.
func createSample(ctx context.Context, tx pgx.Tx, sm Sample) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO tenants (slug, code, name, country, parent_id, legal_form_id, identity_number,
		                     timezone, status, activated_at)
		SELECT $1, $2, $3, $7, (SELECT p.id FROM tenants p WHERE p.slug = nullif($4, '')),
		       lf.id, nullif($6, ''), $8,
		       CASE WHEN $9 THEN 'provisioning' ELSE 'active' END,
		       CASE WHEN $9 THEN NULL ELSE now() END
		  FROM legal_forms lf
		 WHERE lf.country = $7 AND lf.code = $5
		RETURNING id`,
		sm.Slug, sm.Code, sm.Name, sm.Parent, sm.LegalForm, sm.IdentityNumber, sm.Country, sm.Timezone,
		len(sm.Types) == 0).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("sample %s (legal form %q): %w", sm.Slug, sm.LegalForm, err)
	}
	for i, typ := range sm.Types {
		if _, err := tx.Exec(ctx, `INSERT INTO tenant_institution_types (tenant_id, institution_type, is_primary)
			VALUES ($1, $2, $3)`, id, typ, i == 0); err != nil {
			return "", fmt.Errorf("sample %s type %s: %w", sm.Slug, typ, err)
		}
	}
	return id, nil
}
