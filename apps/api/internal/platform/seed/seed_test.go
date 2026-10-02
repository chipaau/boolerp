package seed

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
