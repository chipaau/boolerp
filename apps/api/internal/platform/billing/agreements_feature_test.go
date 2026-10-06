//go:build feature

package billing_test

import (
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// Feature tests (C79) for billing_agreements (C171), in the owner's rolled-back
// transaction: this package's own test country (XG), an operator, a ministry, and a
// hospital the ministry pays for.

type world struct {
	tx                           pgx.Tx
	operator, ministry, hospital string
}

func newWorld(t *testing.T) world {
	t.Helper()
	tx := testdb.OwnerTx(t)
	exec(t, tx, `INSERT INTO countries (code, alpha3, name, phone_prefix) VALUES ('XG', 'XGG', 'Billland', '+996')`)
	return world{tx: tx,
		operator: id(t, tx, `INSERT INTO tenants (slug, code, name, country, is_operator)
			VALUES ('x-billing-operator', 'XGOP', 'Test operator', 'XG', true) RETURNING id`),
		ministry: id(t, tx, `INSERT INTO tenants (slug, code, name, country) VALUES ('x-billing-ministry', 'XGM', 'Ministry', 'XG') RETURNING id`),
		hospital: id(t, tx, `INSERT INTO tenants (slug, code, name, country) VALUES ('x-billing-hospital', 'XGH', 'Hospital', 'XG') RETURNING id`),
	}
}

// agree adds an agreement from starts to ends ("" for open) and returns its id.
func (w world) agree(t *testing.T, tenant, starts, ends string) string {
	t.Helper()
	return id(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, ends_on)
		VALUES ($1, 'monthly', 'MVR', 3500, $2, nullif($3, '')::date) RETURNING id`, tenant, starts, ends)
}

func TestFeatureAnAgreementCanBeFlatPerSeatOrBoth(t *testing.T) {
	w := newWorld(t)
	flat := id(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on)
		VALUES ($1, 'yearly', 'MVR', 30000, '2026-01-01') RETURNING id`, w.ministry)
	both := id(t, w.tx, `INSERT INTO billing_agreements (tenant_id, payer_tenant_id, cycle, currency, recurring_amount,
		per_seat_amount, setup_amount, tax_rate, seat_limit, starts_on, contract_reference)
		VALUES ($1, $2, 'monthly', 'MVR', 3500, 19.5, 10000, 8, 120, '2026-01-01', 'Q-2026-014') RETURNING id`,
		w.hospital, w.ministry)

	testdb.AssertHas(t, w.tx, "billing_agreements", map[string]any{"id": flat, "cycle": "yearly", "tax_rate": "0.00"})
	var perSeat string
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT per_seat_amount::text FROM billing_agreements WHERE id = $1`, both).Scan(&perSeat))
	assert.Equal(t, "19.5000", perSeat, "exact decimal money")
}

func TestFeatureAgreementConstraints(t *testing.T) {
	w := newWorld(t)
	for name, sql := range map[string]string{
		"unknown cycle":            `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on) VALUES ($1, 'weekly', 'MVR', 1, '2026-01-01')`,
		"lowercase currency":       `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on) VALUES ($1, 'monthly', 'mvr', 1, '2026-01-01')`,
		"negative amount":          `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on) VALUES ($1, 'monthly', 'MVR', -1, '2026-01-01')`,
		"negative per seat":        `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, per_seat_amount, starts_on) VALUES ($1, 'monthly', 'MVR', 0, -1, '2026-01-01')`,
		"negative setup":           `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, setup_amount, starts_on) VALUES ($1, 'monthly', 'MVR', 0, -1, '2026-01-01')`,
		"tax over 100":             `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, tax_rate, starts_on) VALUES ($1, 'monthly', 'MVR', 1, 101, '2026-01-01')`,
		"zero seat limit":          `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, seat_limit, starts_on) VALUES ($1, 'monthly', 'MVR', 1, 0, '2026-01-01')`,
		"ending before it starts":  `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, ends_on) VALUES ($1, 'monthly', 'MVR', 1, '2026-02-01', '2026-01-31')`,
		"paying for itself":        `INSERT INTO billing_agreements (tenant_id, payer_tenant_id, cycle, currency, recurring_amount, starts_on) VALUES ($1, $1, 'monthly', 'MVR', 1, '2026-01-01')`,
		"blank contract reference": `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, contract_reference) VALUES ($1, 'monthly', 'MVR', 1, '2026-01-01', ' ')`,
	} {
		_, err := savepoint(t, w.tx, sql, w.ministry)
		assert.Error(t, err, name)
	}
}

func TestFeatureChangingTermsEndsOneAgreementAndStartsTheNext(t *testing.T) {
	w := newWorld(t)
	first := w.agree(t, w.ministry, "2026-01-01", "")

	// A second open agreement is refused while the first is open.
	_, err := savepoint(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on)
		VALUES ($1, 'yearly', 'MVR', 30000, '2026-11-01')`, w.ministry)
	assert.Error(t, err, "one open agreement per tenant")

	exec(t, w.tx, `UPDATE billing_agreements SET ends_on = '2026-10-31' WHERE id = $1`, first)
	next := w.agree(t, w.ministry, "2026-11-01", "")
	testdb.AssertHas(t, w.tx, "billing_agreements", map[string]any{"id": first, "ends_on": "2026-10-31"})
	testdb.AssertHas(t, w.tx, "billing_agreements", map[string]any{"id": next, "ends_on": nil})
}

func TestFeatureAgreementsNeverOverlap(t *testing.T) {
	w := newWorld(t)
	w.agree(t, w.ministry, "2026-01-01", "2026-06-30")
	w.agree(t, w.ministry, "2026-07-01", "")
	w.agree(t, w.hospital, "2026-03-01", "") // another tenant's dates are its own

	for name, dates := range map[string][2]string{
		"inside the first":        {"2026-02-01", "2026-03-31"},
		"on its last day":         {"2026-06-30", "2026-06-30"},
		"across the change":       {"2026-06-01", "2026-07-31"},
		"before, running into it": {"2025-12-01", "2026-01-01"},
	} {
		_, err := savepoint(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, ends_on)
			VALUES ($1, 'monthly', 'MVR', 1, $2, $3)`, w.ministry, dates[0], dates[1])
		assert.Equal(t, "23P01", code(t, err), name)
	}
	_, err := savepoint(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, ends_on)
		VALUES ($1, 'monthly', 'MVR', 1, '2025-01-01', '2025-12-31')`, w.ministry)
	assert.NoError(t, err, "an earlier, separate period is fine")
}

func TestFeatureAnAgreementsTenantNeverChanges(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	_, err := savepoint(t, w.tx, `UPDATE billing_agreements SET tenant_id = $1 WHERE id = $2`, w.hospital, a)
	assert.Equal(t, "23514", code(t, err))
}

func TestFeatureAgreementUpdatedAtFollowsChanges(t *testing.T) {
	w := newWorld(t)
	a := id(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, updated_at)
		VALUES ($1, 'monthly', 'MVR', 1, '2026-01-01', '2000-01-01') RETURNING id`, w.ministry)
	exec(t, w.tx, `UPDATE billing_agreements SET notes = 'Renegotiated' WHERE id = $1`, a)
	var setToNow bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT updated_at = now() FROM billing_agreements WHERE id = $1`, a).Scan(&setToNow))
	assert.True(t, setToNow)
}

func TestFeatureAgreementPolicies(t *testing.T) {
	w := newWorld(t)
	w.agree(t, w.ministry, "2026-01-01", "")
	exec(t, w.tx, `INSERT INTO billing_agreements (tenant_id, payer_tenant_id, cycle, currency, recurring_amount, starts_on)
		VALUES ($1, $2, 'monthly', 'MVR', 1, '2026-01-01')`, w.hospital, w.ministry)
	exec(t, w.tx, `ALTER TABLE billing_agreements FORCE ROW LEVEL SECURITY`)

	visible := func() int {
		var n int
		require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM billing_agreements
			WHERE tenant_id IN ($1, $2)`, w.ministry, w.hospital).Scan(&n))
		return n
	}
	as := func(tenant string) { exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant) }

	as("")
	assert.Zero(t, visible(), "no tenant: nothing")

	as(w.hospital)
	assert.Equal(t, 1, visible(), "a tenant reads its own agreement")
	_, err := savepoint(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, ends_on)
		VALUES ($1, 'monthly', 'MVR', 0, '2025-01-01', '2025-12-31')`, w.hospital)
	assert.Equal(t, "42501", code(t, err), "but never writes one")
	tag, err := savepoint(t, w.tx, `UPDATE billing_agreements SET recurring_amount = 0 WHERE tenant_id = $1`, w.hospital)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "nor changes one")

	as(w.ministry)
	assert.Equal(t, 2, visible(), "the payer also reads the agreements it pays for")

	as(w.operator)
	assert.Equal(t, 2, visible(), "the operator reads every agreement")
	_, err = savepoint(t, w.tx, `INSERT INTO billing_agreements (tenant_id, cycle, currency, recurring_amount, starts_on, ends_on)
		VALUES ($1, 'monthly', 'MVR', 0, '2025-01-01', '2025-12-31')`, w.hospital)
	require.NoError(t, err, "and alone writes them")
	tag, err = savepoint(t, w.tx, `DELETE FROM billing_agreements WHERE tenant_id = $1`, w.ministry)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no one deletes an agreement: it is ended")
}

func exec(t *testing.T, tx pgx.Tx, sql string, args ...any) {
	t.Helper()
	_, err := tx.Exec(t.Context(), sql, args...)
	require.NoError(t, err, sql)
}

func id(t *testing.T, tx pgx.Tx, sql string, args ...any) string {
	t.Helper()
	var v string
	require.NoError(t, tx.QueryRow(t.Context(), sql, args...).Scan(&v), sql)
	return v
}

// code returns the PostgreSQL error code of err, failing when it is not one.
func code(t *testing.T, err error) string {
	t.Helper()
	var pgErr *pgconn.PgError
	require.ErrorAs(t, err, &pgErr)
	return pgErr.Code
}

// savepoint runs sql in a savepoint, so a refused statement does not end the test's transaction.
func savepoint(t *testing.T, tx pgx.Tx, sql string, args ...any) (pgconn.CommandTag, error) {
	t.Helper()
	sp, err := tx.Begin(t.Context())
	require.NoError(t, err)
	tag, err := sp.Exec(t.Context(), sql, args...)
	if err != nil {
		require.NoError(t, sp.Rollback(t.Context()))
		return tag, err
	}
	require.NoError(t, sp.Commit(t.Context()))
	return tag, nil
}
