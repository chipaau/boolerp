package seeds

import (
	"bytes"
	"context"
	"crypto/rand"
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

//go:embed sample_domains.csv
var sampleDomainsCSV []byte

// SampleDomain is one row of sample_domains.csv: a host of a sample tenant.
type SampleDomain struct {
	Tenant, Host, Kind, Serves, Status string
	Primary                            bool
}

// ParseSampleDomains reads sample domains CSV. It rejects a malformed row, a
// repeated host, an unknown kind or status, and a primary that is not active.
// The table's checks catch the rest (the host's form, the portal key's).
func ParseSampleDomains(data []byte) ([]SampleDomain, error) {
	r := csv.NewReader(bytes.NewReader(data))
	r.Comment = '#'
	r.FieldsPerRecord = 6
	header, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("sample domains header: %w", err)
	}
	if strings.Join(header, ",") != "tenant,host,kind,serves,status,primary" {
		return nil, fmt.Errorf("sample domains header: got %q", header)
	}
	var domains []SampleDomain
	seen := map[string]bool{}
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			return domains, nil
		}
		if err != nil {
			return nil, fmt.Errorf("sample domains: %w", err)
		}
		d := SampleDomain{Tenant: rec[0], Host: rec[1], Kind: rec[2], Serves: rec[3], Status: rec[4], Primary: rec[5] == "yes"}
		switch {
		case d.Tenant == "" || d.Host == "" || d.Serves == "":
			return nil, fmt.Errorf("sample domains: a row without tenant, host, or serves")
		case seen[d.Host]:
			return nil, fmt.Errorf("sample domains: duplicate %s", d.Host)
		case d.Kind != "platform" && d.Kind != "custom":
			return nil, fmt.Errorf("sample domains %s: kind %q", d.Host, d.Kind)
		case d.Status != "active" && d.Status != "pending":
			return nil, fmt.Errorf("sample domains %s: status %q", d.Host, d.Status)
		case rec[5] != "yes" && rec[5] != "no":
			return nil, fmt.Errorf("sample domains %s: primary %q", d.Host, rec[5])
		case d.Primary && d.Status != "active":
			return nil, fmt.Errorf("sample domains %s: only an active host is a primary", d.Host)
		}
		seen[d.Host] = true
		domains = append(domains, d)
	}
}

// SampleDomains seeds development's extra hosts of the sample tenants (C158),
// after the sample tenants, as the table owner. A host already present (and not
// revoked) is left as it is.
type SampleDomains struct {
	db   DB
	data []byte
}

// NewSampleDomains returns the seeder over db, with the embedded list.
func NewSampleDomains(db DB) *SampleDomains { return NewSampleDomainsFrom(db, sampleDomainsCSV) }

// NewSampleDomainsFrom returns the seeder over db with another list in the same
// format (tests use their own test tenants and hosts).
func NewSampleDomainsFrom(db DB, data []byte) *SampleDomains {
	return &SampleDomains{db: db, data: data}
}

// Name implements seed.Seeder.
func (*SampleDomains) Name() string { return "tenancy.sample_domains" }

// Run implements seed.Seeder, in one transaction.
func (s *SampleDomains) Run(ctx context.Context, env seed.Env) error {
	if env.Environment != "dev" {
		env.Logger.InfoContext(ctx, "sample domains are seeded only in dev; skipped")
		return nil
	}
	domains, err := ParseSampleDomains(s.data)
	if err != nil {
		return err
	}
	var created, existing int
	// One transaction, attributed to the seeder in the audit (C164).
	err = actor.Tx(ctx, s.db, func(ctx context.Context, tx pgx.Tx) error {
		for _, d := range domains {
			var exists bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM domains WHERE host = $1 AND status <> 'revoked')`,
				d.Host).Scan(&exists); err != nil {
				return fmt.Errorf("sample domain %s: %w", d.Host, err)
			}
			if exists {
				existing++
				continue
			}
			var tenantID string
			if err := tx.QueryRow(ctx, `SELECT id FROM tenants WHERE slug = $1`, d.Tenant).Scan(&tenantID); err != nil {
				return fmt.Errorf("sample domain %s: tenant %s: %w", d.Host, d.Tenant, err)
			}
			// A partial unique index cannot be deferred: unflag the old primary first.
			if d.Primary {
				if _, err := tx.Exec(ctx, `UPDATE domains SET is_primary = false
				WHERE tenant_id = $1 AND serves = $2 AND is_primary`, tenantID, d.Serves); err != nil {
					return fmt.Errorf("sample domain %s: %w", d.Host, err)
				}
			}
			var token *string
			if d.Kind == "custom" {
				t := rand.Text() // 26 base32 characters: two make a token of the required length
				t += rand.Text()
				token = &t
			}
			active := d.Status == "active"
			if _, err := tx.Exec(ctx, `
			INSERT INTO domains (tenant_id, host, kind, serves, status, verification_token,
			                     verified_at, activated_at, is_primary)
			VALUES ($1, $2, $3, $4, $5, $6,
			        CASE WHEN $7 AND $3 = 'custom' THEN now() END, CASE WHEN $7 THEN now() END, $8)`,
				tenantID, d.Host, d.Kind, d.Serves, d.Status, token, active, d.Primary); err != nil {
				return fmt.Errorf("sample domain %s: %w", d.Host, err)
			}
			created++
		}
		return nil
	})
	if err != nil {
		return err
	}
	env.Logger.InfoContext(ctx, "sample domains seeded", "created", created, "existing", existing)
	return nil
}
