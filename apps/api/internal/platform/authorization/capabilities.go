package authorization

import (
	"context"
	"log/slog"
	"net/http"
	"slices"

	"github.com/jackc/pgx/v5"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/problem"
	"github.com/boolmv/erp/apps/api/internal/platform/tenancy/tenant"
)

type capabilitiesKey struct{}

// WithCapabilities returns a copy of ctx carrying the caller's capabilities in the
// request's tenant.
func WithCapabilities(ctx context.Context, caps []string) context.Context {
	return context.WithValue(ctx, capabilitiesKey{}, caps)
}

// CapabilitiesFrom returns the caller's capabilities in the request's tenant (none if
// LoadCapabilities has not run).
func CapabilitiesFrom(ctx context.Context) []string {
	caps, _ := ctx.Value(capabilitiesKey{}).([]string)
	return caps
}

// capabilitiesOf are a membership's capabilities now (C170, C177): from assignments live
// now, of roles not archived, whose app is on in the tenant, through capabilities not
// retired. RequireMember has already checked the membership is active. Read in the
// tenant's transaction, so row-level security limits it to the tenant's own rows and the
// global roles.
const capabilitiesOf = `
SELECT DISTINCT rc.capability
  FROM role_assignments ra
  JOIN roles r            ON r.id = ra.role_id AND r.archived_at IS NULL
  JOIN tenant_apps ta     ON ta.tenant_id = ra.tenant_id AND ta.app_key = r.app_key
                         AND ta.active_from <= now() AND ta.active_to IS NULL
  JOIN role_capabilities rc ON rc.role_id = r.id
  JOIN capabilities c     ON c.key = rc.capability AND c.active_to IS NULL
 WHERE ra.membership_id = $1
   AND ra.active_from <= now() AND (ra.active_to IS NULL OR ra.active_to > now())
 ORDER BY 1`

// LoadCapabilities puts the caller's capabilities in the request's tenant in its
// context, after RequireMember (C150, C177); the principal sends them to Cerbos as
// roles. Without a membership there are none. A database failure answers 503: Cerbos
// would otherwise decide on too few capabilities.
func LoadCapabilities(db tenant.Beginner, logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			m, ok := tenant.MembershipFrom(r.Context())
			if !ok {
				next.ServeHTTP(w, r)
				return
			}
			var caps []string
			err := tenant.ReadTx(r.Context(), db, func(ctx context.Context, tx pgx.Tx) error {
				rows, err := tx.Query(ctx, capabilitiesOf, m.ID)
				if err != nil {
					return err
				}
				caps, err = pgx.CollectRows(rows, pgx.RowTo[string])
				return err
			})
			if err != nil {
				logger.ErrorContext(r.Context(), "loading the caller's capabilities failed", "error", err)
				problem.Error(w, r, http.StatusServiceUnavailable, "Permissions could not be loaded. Try again shortly.")
				return
			}
			next.ServeHTTP(w, r.WithContext(WithCapabilities(r.Context(), slices.Clip(caps))))
		})
	}
}
