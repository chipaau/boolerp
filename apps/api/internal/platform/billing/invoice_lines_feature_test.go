//go:build feature

package billing_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

const insertLine = `INSERT INTO invoice_lines (tenant_id, invoice_id, position, kind, description, quantity, unit_amount, amount)`

func TestFeatureADraftsLinesAddUpWhenItIsIssued(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	inv := w.draft(t, w.ministry, a) // 2280 + 450 = 2730

	// A discount line, with the subtotal not yet updated: issuing is refused.
	exec(t, w.tx, insertLine+` VALUES ($1, $2, 3, 'other', 'Loyalty discount', 1, -230, -230)`, w.ministry, inv)
	_, err := savepoint(t, w.tx, `UPDATE invoices SET status = 'issued', number = 'INV-XG-0100',
		issued_on = '2026-09-01', due_on = '2026-09-15' WHERE id = $1`, inv)
	assert.Equal(t, "23514", code(t, err), "the subtotal is not the sum of the lines")

	exec(t, w.tx, `UPDATE invoices SET subtotal = 2500, total = 2500 WHERE id = $1`, inv)
	w.issue(t, inv, "INV-XG-0100")
	testdb.AssertHas(t, w.tx, "invoices", map[string]any{"id": inv, "status": "issued"})
	assert.Equal(t, 3, testdb.Count(t, w.tx, "invoice_lines", map[string]any{"invoice_id": inv}))
}

func TestFeatureAnInvoiceInsertedIssuedMustAddUp(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	_, err := savepoint(t, w.tx, `INSERT INTO invoices (tenant_id, agreement_id, period_start, period_end, currency,
		subtotal, tax_rate, tax_amount, total, status, number, issued_on, due_on)
		VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 100, 0, 0, 100, 'issued', 'INV-XG-0101', '2026-09-01', '2026-09-15')`,
		w.ministry, a)
	assert.Equal(t, "23514", code(t, err), "no lines: the subtotal must be 0")
	_, err = savepoint(t, w.tx, `INSERT INTO invoices (tenant_id, agreement_id, period_start, period_end, currency,
		subtotal, tax_rate, tax_amount, total, status, number, issued_on, due_on)
		VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 0, 0, 0, 0, 'issued', 'INV-XG-0102', '2026-09-01', '2026-09-15')`,
		w.ministry, a)
	assert.NoError(t, err, "an empty invoice of 0 adds up")
}

func TestFeatureInvoiceLineConstraints(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	inv := w.draft(t, w.ministry, a)
	other := w.draft(t, w.hospital, w.agree(t, w.hospital, "2026-01-01", ""))

	for name, sql := range map[string]string{
		"another tenant's invoice": insertLine + ` VALUES ($1, '` + other + `', 9, 'other', 'X', 1, 1, 1)`,
		"a taken position":         insertLine + ` VALUES ($1, $2, 1, 'other', 'X', 1, 1, 1)`,
		"position zero":            insertLine + ` VALUES ($1, $2, 0, 'other', 'X', 1, 1, 1)`,
		"unknown kind":             insertLine + ` VALUES ($1, $2, 9, 'discount', 'X', 1, 1, 1)`,
		"blank description":        insertLine + ` VALUES ($1, $2, 9, 'other', ' ', 1, 1, 1)`,
		"zero quantity":            insertLine + ` VALUES ($1, $2, 9, 'other', 'X', 0, 1, 0)`,
		"amount not the product":   insertLine + ` VALUES ($1, $2, 9, 'seats', 'Seats', 120, 19, 2000)`,
	} {
		_, err := savepoint(t, w.tx, sql, w.ministry, inv)
		assert.Error(t, err, name)
	}
	_, err := savepoint(t, w.tx, insertLine+` VALUES ($1, $2, 9, 'seats', 'Prorated seats', 2.5, 19.3333, 48.33325)`, w.ministry, inv)
	assert.NoError(t, err, "fractions multiply exactly")
}

func TestFeatureAnIssuedInvoicesLinesAreFrozen(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	inv := w.draft(t, w.ministry, a)
	draft := w.draft(t, w.ministry, a)
	w.issue(t, inv, "INV-XG-0103")

	for name, sql := range map[string]string{
		"adding a line":   insertLine + ` VALUES ($1, $2, 3, 'other', 'Late', 1, 1, 1)`,
		"changing a line": `UPDATE invoice_lines SET description = 'Changed' WHERE invoice_id = $2 AND tenant_id = $1`,
		"removing a line": `DELETE FROM invoice_lines WHERE invoice_id = $2 AND tenant_id = $1`,
		"moving a line":   `UPDATE invoice_lines SET invoice_id = '` + draft + `' WHERE invoice_id = $2 AND tenant_id = $1`,
	} {
		_, err := savepoint(t, w.tx, sql, w.ministry, inv)
		assert.Equal(t, "23514", code(t, err), name)
	}

	// A draft's lines may still change or go.
	exec(t, w.tx, `UPDATE invoice_lines SET description = 'Seats (Sep)' WHERE invoice_id = $1 AND position = 1`, draft)
	exec(t, w.tx, `DELETE FROM invoice_lines WHERE invoice_id = $1 AND position = 2`, draft)
	assert.Equal(t, 1, testdb.Count(t, w.tx, "invoice_lines", map[string]any{"invoice_id": draft}))
}

func TestFeatureInvoiceLineUpdatedAtFollowsChanges(t *testing.T) {
	w := newWorld(t)
	inv := w.draft(t, w.ministry, w.agree(t, w.ministry, "2026-01-01", ""))
	line := id(t, w.tx, insertLine[:len(insertLine)-1]+`, updated_at) VALUES ($1, $2, 9, 'other', 'X', 1, 1, 1, '2000-01-01') RETURNING id`,
		w.ministry, inv)
	exec(t, w.tx, `UPDATE invoice_lines SET description = 'Y' WHERE id = $1`, line)
	var setToNow bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT updated_at = now() FROM invoice_lines WHERE id = $1`, line).Scan(&setToNow))
	assert.True(t, setToNow)
}

func TestFeatureInvoiceLinePolicies(t *testing.T) {
	w := newWorld(t)
	own := w.agree(t, w.ministry, "2026-01-01", "")
	paid := id(t, w.tx, `INSERT INTO billing_agreements (tenant_id, payer_tenant_id, cycle, currency, recurring_amount, starts_on)
		VALUES ($1, $2, 'monthly', 'MVR', 1, '2026-01-01') RETURNING id`, w.hospital, w.ministry)
	ministryIssued := w.draft(t, w.ministry, own)
	w.issue(t, ministryIssued, "INV-XG-0110")
	ministryDraft := w.draft(t, w.ministry, own)
	hospitalIssued := w.draft(t, w.hospital, paid)
	w.issue(t, hospitalIssued, "INV-XG-0111")
	exec(t, w.tx, `ALTER TABLE invoice_lines FORCE ROW LEVEL SECURITY`)

	visible := func() int {
		var n int
		require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM invoice_lines
			WHERE tenant_id IN ($1, $2)`, w.ministry, w.hospital).Scan(&n))
		return n
	}
	as := func(tenant string) { exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant) }

	as("")
	assert.Zero(t, visible(), "no tenant: nothing")

	as(w.hospital)
	assert.Equal(t, 2, visible(), "a tenant reads the lines of its own issued invoices")
	_, err := savepoint(t, w.tx, insertLine+` VALUES ($1, $2, 3, 'other', 'X', 1, 1, 1)`, w.ministry, ministryDraft)
	assert.Equal(t, "42501", code(t, err), "but never writes one")

	as(w.ministry)
	assert.Equal(t, 4, visible(), "its own issued invoice's and the hospital's it pays for, not its draft's")

	as(w.operator)
	assert.Equal(t, 6, visible(), "the operator reads every line, drafts' too")
	tag, err := savepoint(t, w.tx, `DELETE FROM invoice_lines WHERE invoice_id = $1`, ministryDraft)
	require.NoError(t, err)
	assert.EqualValues(t, 2, tag.RowsAffected(), "and removes a draft's lines")
}
