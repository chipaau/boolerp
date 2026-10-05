package seeds

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

// ensurePlatformDomain gives a tenant its platform workspace host,
// <slug>.<platformDomain> (C158, C159), active at once, unless it already has a
// platform workspace host that is not revoked. It is the primary when the tenant
// has no primary workspace host yet. Running it again adds nothing.
func ensurePlatformDomain(ctx context.Context, tx pgx.Tx, tenantID, slug, platformDomain string) (added bool, err error) {
	tag, err := tx.Exec(ctx, `
		INSERT INTO domains (tenant_id, host, kind, serves, status, activated_at, is_primary)
		SELECT $1, $2, 'platform', 'workspace', 'active', now(),
		       NOT EXISTS (SELECT 1 FROM domains d WHERE d.tenant_id = $1 AND d.serves = 'workspace' AND d.is_primary)
		 WHERE NOT EXISTS (SELECT 1 FROM domains d WHERE d.tenant_id = $1 AND d.kind = 'platform'
		                      AND d.serves = 'workspace' AND d.status <> 'revoked')`,
		tenantID, slug+"."+platformDomain)
	if err != nil {
		return false, fmt.Errorf("the platform domain of %s: %w", slug, err)
	}
	return tag.RowsAffected() == 1, nil
}
