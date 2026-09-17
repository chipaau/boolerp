package auth

import "context"

// Principal is the authenticated caller, resolved from the Kratos session + the users mirror.
// Tenant membership and roles are layered on later (components 03 + 05).
type Principal struct {
	ID    string // = Kratos subject = users.id
	Email string
	Name  string
}

type ctxKey int

const (
	principalKey ctxKey = iota
	authzPrincipalKey
)

// WithPrincipal stores the authenticated principal in the request context.
func WithPrincipal(ctx context.Context, p *Principal) context.Context {
	return context.WithValue(ctx, principalKey, p)
}

// PrincipalFrom retrieves the authenticated principal, if any.
func PrincipalFrom(ctx context.Context) (*Principal, bool) {
	p, ok := ctx.Value(principalKey).(*Principal)
	return p, ok
}

// WithAuthzPrincipal stores the resolved authorization principal — membership + capabilities — in
// the request context, so the middleware that resolves it and everything below share one lookup
// instead of each re-querying the same rows.
func WithAuthzPrincipal(ctx context.Context, p AuthzPrincipal) context.Context {
	return context.WithValue(ctx, authzPrincipalKey, p)
}

// AuthzPrincipalFrom retrieves the resolved authorization principal, if a middleware put one there.
func AuthzPrincipalFrom(ctx context.Context) (AuthzPrincipal, bool) {
	p, ok := ctx.Value(authzPrincipalKey).(AuthzPrincipal)
	return p, ok
}
