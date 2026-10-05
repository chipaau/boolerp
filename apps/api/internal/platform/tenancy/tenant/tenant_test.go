package tenant

import (
	"context"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWithAndFrom(t *testing.T) {
	_, ok := From(context.Background())
	assert.False(t, ok, "no tenant")
	_, ok = From(With(context.Background(), Tenant{}))
	assert.False(t, ok, "a tenant without an ID is no tenant")

	want := Tenant{ID: "0192f6a0-0000-7000-8000-000000000001", Code: "HAAH", Status: "active"}
	got, ok := From(With(context.Background(), want))
	require.True(t, ok)
	assert.Equal(t, want, got)
}

// begins fails the test if a transaction is begun at all.
type begins struct{ t *testing.T }

func (b begins) BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error) {
	b.t.Fatal("no transaction should begin")
	return nil, nil
}

func TestTxRefusesBeforeBeginning(t *testing.T) {
	noop := func(context.Context, pgx.Tx) error { t.Fatal("fn should not run"); return nil }
	for _, run := range []func(context.Context, Beginner, func(context.Context, pgx.Tx) error) error{Tx, ReadTx} {
		assert.ErrorIs(t, run(context.Background(), begins{t}, noop), ErrNoTenant)

		inside := context.WithValue(With(context.Background(), Tenant{ID: "x"}), insideKey{}, true)
		assert.ErrorIs(t, run(inside, begins{t}, noop), ErrNested)
	}
}

func TestMembershipTravelsInTheContext(t *testing.T) {
	_, ok := MembershipFrom(context.Background())
	assert.False(t, ok)
	_, ok = MembershipFrom(WithMembership(context.Background(), Membership{}))
	assert.False(t, ok, "a membership without an ID is none")

	m, ok := MembershipFrom(WithMembership(context.Background(), Membership{ID: "m", IsOwner: true}))
	assert.True(t, ok)
	assert.Equal(t, Membership{ID: "m", IsOwner: true}, m)
}
