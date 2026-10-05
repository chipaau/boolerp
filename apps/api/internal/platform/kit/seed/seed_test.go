package seed

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/actor"
)

type recorder struct {
	name string
	ran  *[]string
	err  error
}

func (r recorder) Name() string { return r.name }

func (r recorder) Run(_ context.Context, env Env) error {
	*r.ran = append(*r.ran, r.name+":"+env.Environment)
	return r.err
}

func TestRunsSeedersInOrderAndStopsAtAFailure(t *testing.T) {
	var ran []string
	seeders := []Seeder{
		recorder{name: "a", ran: &ran},
		recorder{name: "b", ran: &ran, err: errors.New("boom")},
		recorder{name: "c", ran: &ran},
	}
	err := Run(t.Context(), seeders, NewEnv("dev", slog.New(slog.DiscardHandler)))
	require.Error(t, err)
	assert.Contains(t, err.Error(), "seed b")
	assert.Equal(t, []string{"a:dev", "b:dev"}, ran)
}

func TestFakeDataIsTheSameOnEveryRun(t *testing.T) {
	a := NewEnv("dev", slog.New(slog.DiscardHandler)).Fake
	b := NewEnv("dev", slog.New(slog.DiscardHandler)).Fake
	assert.Equal(t, a.Name(), b.Name())
	assert.Equal(t, a.Email(), b.Email())
}

// operations records the audit operation each seeder runs under.
type operations struct {
	name string
	seen *[]string
}

func (o operations) Name() string { return o.name }

func (o operations) Run(ctx context.Context, _ Env) error {
	*o.seen = append(*o.seen, actor.From(ctx).Operation)
	return nil
}

func TestEachSeederIsTheAuditedOperation(t *testing.T) {
	var seen []string
	require.NoError(t, Run(t.Context(), []Seeder{operations{"tenancy.operator", &seen}, operations{"reference.countries", &seen}},
		NewEnv("dev", slog.New(slog.DiscardHandler))))
	assert.Equal(t, []string{"seed: tenancy.operator", "seed: reference.countries"}, seen)
}
