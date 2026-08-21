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

const principalKey ctxKey = iota

// WithPrincipal stores the authenticated principal in the request context.
func WithPrincipal(ctx context.Context, p *Principal) context.Context {
	return context.WithValue(ctx, principalKey, p)
}

// PrincipalFrom retrieves the authenticated principal, if any.
func PrincipalFrom(ctx context.Context) (*Principal, bool) {
	p, ok := ctx.Value(principalKey).(*Principal)
	return p, ok
}
