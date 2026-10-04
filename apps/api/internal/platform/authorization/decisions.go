package authorization

import (
	"context"
	"sync/atomic"
)

// decisions counts the authorization decisions made while handling one request,
// whatever their outcome, so Enforce can refuse a route that made none (C155).
type decisions struct{ n atomic.Int64 }

type decisionsKey struct{}

func withDecisions(ctx context.Context) (context.Context, *decisions) {
	d := &decisions{}
	return context.WithValue(ctx, decisionsKey{}, d), d
}

// NoteDecision records that ctx's request asked for a decision, so Enforce lets
// its response through. Every Authorizer implementation calls it once per Check or
// Can, whatever the outcome; outside a request (a CLI command, a job) it does
// nothing.
func NoteDecision(ctx context.Context) {
	if d, ok := ctx.Value(decisionsKey{}).(*decisions); ok {
		d.n.Add(1)
	}
}
