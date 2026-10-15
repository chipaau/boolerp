// Package authztest fakes Cerbos for tests (C156): an Authorizer that states its answer
// and remembers what it was asked. Endpoint tests use it instead of each writing their own.
package authztest

import (
	"context"

	"github.com/boolmv/erp/apps/api/internal/platform/authorization"
)

// Stated answers every decision the same way: Err when set, otherwise allowed when Allow
// and denied when not. Like every Authorizer, it notes each decision, so Enforce lets the
// response through. Asked holds the records it was asked about, Cans each "action kind"
// it was asked without one.
type Stated struct {
	Allow bool
	Err   error
	Asked []authorization.Resource
	Cans  []string
}

// Check implements authorization.Authorizer.
func (s *Stated) Check(ctx context.Context, _ string, r authorization.Resource, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	s.Asked = append(s.Asked, r)
	return s.answer()
}

// Can implements authorization.Authorizer.
func (s *Stated) Can(ctx context.Context, action, kind string, _ ...authorization.Fact) error {
	authorization.NoteDecision(ctx)
	s.Cans = append(s.Cans, action+" "+kind)
	return s.answer()
}

func (s *Stated) answer() error {
	switch {
	case s.Err != nil:
		return s.Err
	case s.Allow:
		return nil
	default:
		return authorization.ErrDenied
	}
}

var _ authorization.Authorizer = (*Stated)(nil)
