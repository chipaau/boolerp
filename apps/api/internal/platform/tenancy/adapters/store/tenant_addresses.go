package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/postgres"
	"github.com/boolmv/erp/apps/api/internal/platform/kit/request"
)

// TenantAddressListSpec is what GET /api/v1/tenants/{id}/addresses accepts: a tenant's
// one or two addresses, registered first.
var TenantAddressListSpec = request.ListSpec{Sorts: []string{"kind"}, DefaultSort: "-kind"}

// TenantAddress is a tenant's address as the API shows it (C215).
type TenantAddress struct {
	Kind, Country, Line1         string
	GeographyID, Line2, Postcode *string
	TypedPlaces                  map[string]string
	Latitude, Longitude          *float64
	UpdatedAt                    time.Time
}

const tenantAddressColumns = `a.kind, a.country, a.geography_id::text, a.typed_places, a.line1, a.line2,
	a.postal_code, a.latitude::float8, a.longitude::float8, a.updated_at`

func scanTenantAddress(row pgx.Row, a *TenantAddress, extra ...any) error {
	return row.Scan(append([]any{&a.Kind, &a.Country, &a.GeographyID, &a.TypedPlaces, &a.Line1, &a.Line2,
		&a.Postcode, &a.Latitude, &a.Longitude, &a.UpdatedAt}, extra...)...)
}

// TenantStatus returns a tenant's status, which deciding on its addresses needs; ok is
// false when the transaction sees no such tenant.
func TenantStatus(ctx context.Context, tx pgx.Tx, id string) (status string, ok bool, err error) {
	err = tx.QueryRow(ctx, `SELECT status FROM tenants WHERE id::text = $1`, id).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	return status, err == nil, err
}

// ListTenantAddresses reads a tenant's addresses and how many it has.
func ListTenantAddresses(ctx context.Context, tx pgx.Tx, tenant string, l request.List) ([]TenantAddress, int, error) {
	q := postgres.ListQuery{From: "tenant_addresses a", Key: "a.id", Sorts: map[string]string{"kind": "a.kind"}}
	q.Equal("a.tenant_id", tenant)
	items := []TenantAddress{}
	total, err := q.Run(ctx, tx, l, tenantAddressColumns, func(rows pgx.Rows, total *int) error {
		var a TenantAddress
		if err := scanTenantAddress(rows, &a, total); err != nil {
			return err
		}
		items = append(items, a)
		return nil
	})
	return items, total, err
}

// NewTenantAddress is an address to set; empty optional fields are stored as null.
type NewTenantAddress struct {
	Kind, Country, GeographyID, Line1, Line2, Postcode string
	TypedPlaces                                        map[string]string
	Latitude, Longitude                                *float64
}

// SetTenantAddress adds tenant's address of a kind, or replaces it, and returns it and
// whether it is new. Row-level security lets only the operator tenant write one.
func SetTenantAddress(ctx context.Context, tx pgx.Tx, tenant string, n NewTenantAddress) (TenantAddress, bool, error) {
	typed := n.TypedPlaces
	if typed == nil {
		typed = map[string]string{}
	}
	var a TenantAddress
	var isNew bool
	err := scanTenantAddress(tx.QueryRow(ctx, `
		INSERT INTO tenant_addresses AS a (tenant_id, kind, country, geography_id, typed_places, line1, line2,
		                                   postal_code, latitude, longitude)
		VALUES ($1, $2, $3, nullif($4, '')::uuid, $5, $6, nullif($7, ''), nullif($8, ''), $9, $10)
		ON CONFLICT (tenant_id, kind) DO UPDATE
		   SET country = EXCLUDED.country, geography_id = EXCLUDED.geography_id,
		       typed_places = EXCLUDED.typed_places, line1 = EXCLUDED.line1, line2 = EXCLUDED.line2,
		       postal_code = EXCLUDED.postal_code, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
		RETURNING `+tenantAddressColumns+`, xmax = 0`,
		tenant, n.Kind, n.Country, n.GeographyID, typed, n.Line1, n.Line2, n.Postcode, n.Latitude, n.Longitude),
		&a, &isNew)
	return a, isNew, err
}

// DeleteTenantAddress removes tenant's address of a kind, reporting whether it had one.
func DeleteTenantAddress(ctx context.Context, tx pgx.Tx, tenant, kind string) (bool, error) {
	tag, err := tx.Exec(ctx, `DELETE FROM tenant_addresses WHERE tenant_id = $1 AND kind = $2`, tenant, kind)
	return tag.RowsAffected() > 0, err
}
