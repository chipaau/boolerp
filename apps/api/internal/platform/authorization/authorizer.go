package authorization

import (
	"context"
	"errors"
)

// Resource is what a check is about: its kind (the policy's resource, such as
// "identity:user"), its ID, and only the attributes the policy needs (C150), which
// must match the policy's schema or Cerbos rejects the request (C151). A record
// being created has no ID yet: leave it empty and pass its attributes.
type Resource struct {
	Kind       string
	ID         string
	Attributes map[string]any
}

// Principal is who is asking, as Cerbos sees them: an ID, roles (user or client;
// inside a tenant, member and the caller's capabilities there, C150, C154), and
// attributes (the tenant). It is never passed by a module: the adapter builds it
// from ctx with a PrincipalFunc, so a module cannot ask on someone else's behalf.
type Principal struct {
	ID         string
	Roles      []string
	Attributes map[string]any
}

// PrincipalFunc builds the principal from the request's context: the
// authenticated caller and the tenant. The edition provides it.
type PrincipalFunc func(ctx context.Context) (Principal, error)

// Fact adds principal attributes that one decision needs, such as the caller's
// employee ID and units for a rule about their reporting line, so they are loaded
// and sent only when a policy uses them. The policy's schema requires them, so a
// forgotten fact fails as ErrInvalid instead of denying silently.
type Fact func(attributes map[string]any)

// Facts returns a Fact that adds attributes.
func Facts(attributes map[string]any) Fact {
	return func(into map[string]any) {
		for k, v := range attributes {
			into[k] = v
		}
	}
}

// Authorizer is the one way a module asks whether an operation may proceed (C144,
// C155): in the application path, so HTTP, CLI commands, and jobs are protected
// alike. nil means allowed; anything else means do not proceed.
type Authorizer interface {
	// Check asks whether the caller may do action on this record (or, with no ID,
	// on a record being created with these attributes).
	Check(ctx context.Context, action string, r Resource, facts ...Fact) error
	// Can asks whether the caller may do action on any record of this kind, such
	// as whether to open an approvals screen at all. It never authorizes a
	// specific record: acting on one still needs Check.
	Can(ctx context.Context, action, kind string, facts ...Fact) error
}

// The ways a check does not allow. Callers stop on any error; WriteError turns
// them into responses.
var (
	// ErrDenied: the policy said no, or there is no caller to allow.
	ErrDenied = errors.New("authorization: denied")
	// ErrInvalid: Cerbos rejected the request (an attribute missing or not
	// allowed by the policy's schema): a bug in our code, not a normal denial.
	ErrInvalid = errors.New("authorization: invalid request")
	// ErrUnavailable: Cerbos could not be asked (timeout, connection failure).
	ErrUnavailable = errors.New("authorization: Cerbos unavailable")
)
