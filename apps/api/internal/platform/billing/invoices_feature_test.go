//go:build feature

package billing_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/testdb"
)

// draft adds a draft invoice for September 2026 under agreement (MVR, 0% tax), with lines
// adding up to its subtotal (120 seats at 19, and a 450 site pack), and returns its id.
func (w world) draft(t *testing.T, tenant, agreement string) string {
	t.Helper()
	inv := id(t, w.tx, `INSERT INTO invoices (tenant_id, agreement_id, period_start, period_end, currency,
		subtotal, tax_rate, tax_amount, total)
		VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 2730, 0, 0, 2730) RETURNING id`, tenant, agreement)
	exec(t, w.tx, `INSERT INTO invoice_lines (tenant_id, invoice_id, position, kind, description, quantity, unit_amount, amount)
		VALUES ($1, $2, 1, 'seats', 'Seats', 120, 19, 2280), ($1, $2, 2, 'other', 'Extra site pack', 1, 450, 450)`, tenant, inv)
	return inv
}

// issue issues invoice with number.
func (w world) issue(t *testing.T, invoice, number string) {
	t.Helper()
	exec(t, w.tx, `UPDATE invoices SET status = 'issued', number = $2, issued_on = '2026-09-01', due_on = '2026-09-15'
		WHERE id = $1`, invoice, number)
}

func TestFeatureAnInvoiceIsDraftedIssuedAndPaid(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	inv := w.draft(t, w.ministry, a)
	exec(t, w.tx, `UPDATE invoices SET notes = 'Thank you', po_reference = 'PO-77' WHERE id = $1`, inv)

	w.issue(t, inv, "INV-XG-0001")
	exec(t, w.tx, `UPDATE invoices SET status = 'paid', paid_on = '2026-09-12' WHERE id = $1`, inv)
	testdb.AssertHas(t, w.tx, "invoices", map[string]any{
		"id": inv, "status": "paid", "number": "INV-XG-0001", "paid_on": "2026-09-12", "po_reference": "PO-77",
	})
}

func TestFeatureInvoiceConstraints(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "2026-12-31")
	other := w.agree(t, w.hospital, "2026-01-01", "")
	const cols = `INSERT INTO invoices (tenant_id, agreement_id, period_start, period_end, currency, subtotal, tax_rate, tax_amount, total`
	for name, sql := range map[string]string{
		"another tenant's agreement": cols + `) VALUES ($1, '` + other + `', '2026-09-01', '2026-09-30', 'MVR', 1, 0, 0, 1)`,
		"total not the sum":          cols + `) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 100, 8, 8, 100)`,
		"negative subtotal":          cols + `) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', -1, 0, 0, -1)`,
		"period ending first":        cols + `) VALUES ($1, $2, '2026-09-30', '2026-09-01', 'MVR', 1, 0, 0, 1)`,
		"other currency":             cols + `) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'USD', 1, 0, 0, 1)`,
		"other tax rate":             cols + `) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 100, 8, 8, 108)`,
		"before the agreement":       cols + `) VALUES ($1, $2, '2025-12-01', '2025-12-31', 'MVR', 1, 0, 0, 1)`,
		"after the agreement":        cols + `) VALUES ($1, $2, '2026-12-01', '2027-01-31', 'MVR', 1, 0, 0, 1)`,
		"a draft with a number":      cols + `, number) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 1, 0, 0, 1, 'INV-1')`,
		"issued without a number":    cols + `, status, issued_on, due_on) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 1, 0, 0, 1, 'issued', '2026-09-01', '2026-09-15')`,
		"due before issued":          cols + `, status, number, issued_on, due_on) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 1, 0, 0, 1, 'issued', 'INV-2', '2026-09-15', '2026-09-01')`,
		"paid without a date":        cols + `, status, number, issued_on, due_on) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 1, 0, 0, 1, 'paid', 'INV-3', '2026-09-01', '2026-09-15')`,
		"unknown status":             cols + `, status) VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 1, 0, 0, 1, 'overdue')`,
	} {
		_, err := savepoint(t, w.tx, sql, w.ministry, a)
		assert.Error(t, err, name)
	}
}

func TestFeatureAnIssuedInvoiceIsFrozen(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	inv := w.draft(t, w.ministry, a)
	w.issue(t, inv, "INV-XG-0002")

	for name, sql := range map[string]string{
		"its amount":    `UPDATE invoices SET subtotal = 1, total = 1 WHERE id = $1`,
		"its number":    `UPDATE invoices SET number = 'INV-XG-9999' WHERE id = $1`,
		"its due date":  `UPDATE invoices SET due_on = '2026-10-15' WHERE id = $1`,
		"its notes":     `UPDATE invoices SET notes = 'changed' WHERE id = $1`,
		"back to draft": `UPDATE invoices SET status = 'draft', number = null WHERE id = $1`,
		"its agreement": `UPDATE invoices SET agreement_id = '` + w.agree(t, w.hospital, "2026-01-01", "") + `' WHERE id = $1`,
		"its tenant":    `UPDATE invoices SET tenant_id = '` + w.hospital + `' WHERE id = $1`,
	} {
		_, err := savepoint(t, w.tx, sql, inv)
		assert.Equal(t, "23514", code(t, err), name)
	}

	// Paid and void are final.
	exec(t, w.tx, `UPDATE invoices SET status = 'paid', paid_on = '2026-09-12' WHERE id = $1`, inv)
	_, err := savepoint(t, w.tx, `UPDATE invoices SET status = 'void' WHERE id = $1`, inv)
	assert.Equal(t, "23514", code(t, err), "a paid invoice is not voided: it is credited")
	_, err = savepoint(t, w.tx, `UPDATE invoices SET paid_on = '2026-09-13' WHERE id = $1`, inv)
	assert.Equal(t, "23514", code(t, err), "its payment date is final")

	voided := w.draft(t, w.ministry, a)
	w.issue(t, voided, "INV-XG-0003")
	exec(t, w.tx, `UPDATE invoices SET status = 'void' WHERE id = $1`, voided)
	_, err = savepoint(t, w.tx, `UPDATE invoices SET status = 'issued' WHERE id = $1`, voided)
	assert.Equal(t, "23514", code(t, err), "a void invoice stays void")
}

func TestFeatureAnInvoiceNumberIsNeverReused(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	first := w.draft(t, w.ministry, a)
	w.issue(t, first, "INV-XG-0004")
	exec(t, w.tx, `UPDATE invoices SET status = 'void' WHERE id = $1`, first)
	second := w.draft(t, w.ministry, a)
	_, err := savepoint(t, w.tx, `UPDATE invoices SET status = 'issued', number = 'INV-XG-0004',
		issued_on = '2026-09-01', due_on = '2026-09-15' WHERE id = $1`, second)
	assert.Equal(t, "23505", code(t, err), "even a voided invoice keeps its number")
}

func TestFeatureInvoiceUpdatedAtFollowsChanges(t *testing.T) {
	w := newWorld(t)
	a := w.agree(t, w.ministry, "2026-01-01", "")
	inv := id(t, w.tx, `INSERT INTO invoices (tenant_id, agreement_id, period_start, period_end, currency,
		subtotal, tax_rate, tax_amount, total, updated_at)
		VALUES ($1, $2, '2026-09-01', '2026-09-30', 'MVR', 1, 0, 0, 1, '2000-01-01') RETURNING id`, w.ministry, a)
	exec(t, w.tx, `UPDATE invoices SET notes = 'Draft note' WHERE id = $1`, inv)
	var setToNow bool
	require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT updated_at = now() FROM invoices WHERE id = $1`, inv).Scan(&setToNow))
	assert.True(t, setToNow)
}

func TestFeatureInvoicePolicies(t *testing.T) {
	w := newWorld(t)
	own := w.agree(t, w.ministry, "2026-01-01", "")
	paid := id(t, w.tx, `INSERT INTO billing_agreements (tenant_id, payer_tenant_id, cycle, currency, recurring_amount, starts_on)
		VALUES ($1, $2, 'monthly', 'MVR', 1, '2026-01-01') RETURNING id`, w.hospital, w.ministry)
	ministryIssued := w.draft(t, w.ministry, own)
	w.issue(t, ministryIssued, "INV-XG-0010")
	w.draft(t, w.ministry, own) // a draft: Bool's only
	hospitalIssued := w.draft(t, w.hospital, paid)
	w.issue(t, hospitalIssued, "INV-XG-0011")
	exec(t, w.tx, `ALTER TABLE invoices FORCE ROW LEVEL SECURITY`)

	visible := func() int {
		var n int
		require.NoError(t, w.tx.QueryRow(t.Context(), `SELECT count(*) FROM invoices
			WHERE tenant_id IN ($1, $2)`, w.ministry, w.hospital).Scan(&n))
		return n
	}
	as := func(tenant string) { exec(t, w.tx, `SELECT set_config('app.tenant_id', $1, true)`, tenant) }

	as("")
	assert.Zero(t, visible(), "no tenant: nothing")

	as(w.hospital)
	assert.Equal(t, 1, visible(), "a tenant reads its own issued invoices")
	tag, err := savepoint(t, w.tx, `UPDATE invoices SET status = 'void' WHERE id = $1`, hospitalIssued)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "but never changes one")
	_, err = savepoint(t, w.tx, `INSERT INTO invoices (tenant_id, agreement_id, period_start, period_end, currency,
		subtotal, tax_rate, tax_amount, total) VALUES ($1, $2, '2026-10-01', '2026-10-31', 'MVR', 1, 0, 0, 1)`, w.hospital, paid)
	assert.Equal(t, "42501", code(t, err), "nor writes one")

	as(w.ministry)
	assert.Equal(t, 2, visible(), "its own issued one and the hospital's it pays for, not its draft")

	as(w.operator)
	assert.Equal(t, 3, visible(), "the operator reads every invoice, drafts too")
	tag, err = savepoint(t, w.tx, `DELETE FROM invoices WHERE id = $1`, ministryIssued)
	require.NoError(t, err)
	assert.Zero(t, tag.RowsAffected(), "no one deletes an invoice: it is voided")
}
