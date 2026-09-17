import { describe, expect, it } from 'vitest'
import { addDays, addMonths, autoIssuedNumbers, defaultPayInvoice, invoiceDisplayStatus, isUnderReview, payableInvoices, paymentsFor, receiptStorageKey, autoIssuedText, billingPeriods, draftInvoice, invoicesToGenerate, issuedStatus, nextInvoiceNumber } from './logic'
import type { InvoiceStatus, PaymentStatus, PaymentSubmission, Subscription, TenantInvoice } from './types'

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  plan: 'Basic', cycle: 'Monthly', seatsIncluded: 120, seatsUsed: 96, pricePerSeat: 19, currency: 'MVR', renewsOn: '2026-10-01', apps: [], ...over,
})
const inv = (number: string, periodFrom: string, periodTo: string): TenantInvoice => ({
  id: number, number, periodFrom, periodTo, issuedOn: periodFrom, dueOn: periodFrom, status: 'Paid', lines: [], subtotal: 0, gst: 0, total: 0, currency: 'MVR',
})

describe('date helpers', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('adds months, clamping the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-10-01', -13)).toBe('2025-09-01')
  })
})

describe('billingPeriods', () => {
  it('builds monthly periods around today', () => {
    expect(billingPeriods(sub(), '2026-09-17', 2, 1)).toEqual([
      { from: '2026-07-01', to: '2026-07-31' },
      { from: '2026-08-01', to: '2026-08-31' },
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-10-01', to: '2026-10-31' },
    ])
  })
  it('handles today on a period boundary and mid-month anchors', () => {
    expect(billingPeriods(sub({ renewsOn: '2026-10-15' }), '2026-09-15', 0, 0)).toEqual([{ from: '2026-09-15', to: '2026-10-14' }])
    expect(billingPeriods(sub({ renewsOn: '2026-10-15' }), '2026-09-14', 0, 0)).toEqual([{ from: '2026-08-15', to: '2026-09-14' }])
  })
  it('builds annual periods', () => {
    expect(billingPeriods(sub({ cycle: 'Annual', renewsOn: '2027-04-01' }), '2026-09-17', 1, 1)).toEqual([
      { from: '2025-04-01', to: '2026-03-31' },
      { from: '2026-04-01', to: '2027-03-31' },
      { from: '2027-04-01', to: '2028-03-31' },
    ])
  })
  it('uses default window sizes', () => {
    expect(billingPeriods(sub(), '2026-09-17')).toHaveLength(14)
  })
})

describe('nextInvoiceNumber', () => {
  it('continues the year series and restarts in a new year', () => {
    const list = [inv('INV-2026-0914', 'a', 'b'), inv('CN-2026-0999', 'a', 'b'), inv('INV-2025-1200', 'a', 'b')]
    expect(nextInvoiceNumber(list, '2026')).toBe('INV-2026-0915')
    expect(nextInvoiceNumber(list, '2027')).toBe('INV-2027-0001')
  })
})

describe('issuedStatus', () => {
  it('is Due through the due date, Overdue after', () => {
    expect(issuedStatus('2026-10-15', '2026-10-15')).toBe('Due')
    expect(issuedStatus('2026-10-15', '2026-10-16')).toBe('Overdue')
  })
})

describe('draftInvoice', () => {
  const sept = { from: '2026-09-01', to: '2026-09-30' }
  it('bills plan seats, exempt GST, due 14 days after issue', () => {
    const d = draftInvoice(sub(), sept, 96, 0)
    expect(d.lines).toEqual([{ label: 'Basic plan seats', qty: 120, unitAmount: 19 }])
    expect(d).toMatchObject({ subtotal: 2280, gst: 0, total: 2280, issuedOn: '2026-10-01', dueOn: '2026-10-15', status: 'Draft', number: 'INV-2026-0001', id: 'inv-2026-09-01' })
  })
  it('adds extra seats and 8% GST for a private tenant', () => {
    const d = draftInvoice(sub(), sept, 125, 8)
    expect(d.lines[1]).toEqual({ label: 'Extra seats above 120', qty: 5, unitAmount: 19 })
    expect(d).toMatchObject({ subtotal: 2375, gst: 190, total: 2565 })
  })
  it('adds no extra seats at exactly the allowance', () => {
    expect(draftInvoice(sub(), sept, 120, 0).lines).toHaveLength(1)
  })
  it('rounds GST and totals to 2dp', () => {
    const d = draftInvoice(sub({ seatsIncluded: 1, pricePerSeat: 10.37 }), sept, 1, 8)
    expect(d.gst).toBe(0.83)
    expect(d.total).toBe(11.2)
  })
  it('prorates a plan change effective inside the period', () => {
    const s = sub({ pendingChange: { plan: 'Pro', seats: 200, effectiveOn: '2026-09-16' } })
    const d = draftInvoice(s, sept, 96, 0)
    // (200 x 16 - 120 x 19) x 15/30 = 460
    expect(d.lines[1]).toEqual({ label: 'Pro with 200 seats from 2026-09-16 (prorated 15/30 days)', qty: 1, unitAmount: 460 })
    expect(d.total).toBe(2740)
  })
  it('ignores a plan change outside the period', () => {
    const s = sub({ pendingChange: { plan: 'Pro', seats: 200, effectiveOn: '2026-10-01' } })
    expect(draftInvoice(s, sept, 96, 0).lines).toHaveLength(1)
  })
  it('bills twelve months on an annual cycle', () => {
    const s = sub({ cycle: 'Annual', renewsOn: '2027-04-01', pendingChange: { plan: 'Pro', seats: 120, effectiveOn: '2027-03-01' } })
    const d = draftInvoice(s, { from: '2026-04-01', to: '2027-03-31' }, 121, 0)
    expect(d.lines[0]).toEqual({ label: 'Basic plan seats (12 months)', qty: 120, unitAmount: 228 })
    expect(d.lines[1]).toEqual({ label: 'Extra seats above 120 (12 months)', qty: 1, unitAmount: 228 })
    // (120 x 16 - 120 x 19) x 12 x 31/365
    expect(d.lines[2].unitAmount).toBe(-366.9)
    expect(d.issuedOn).toBe('2027-04-01')
  })
})

describe('invoicesToGenerate', () => {
  const history = [inv('INV-2026-0914', '2026-09-01', '2026-09-30'), inv('INV-2026-0811', '2026-08-01', '2026-08-31'), inv('CN-2026-0007', '2026-07-01', '2026-07-31')]
  it('issues nothing while the latest period is still running', () => {
    expect(invoicesToGenerate(history, sub(), '2026-09-17')).toEqual([])
  })
  it('issues each ended period after the last invoice in sequence, Due or Overdue, and never twice', () => {
    const out = invoicesToGenerate(history, sub(), '2026-12-02', 8)
    expect(out.map((i) => [i.periodFrom, i.number, i.status])).toEqual([
      ['2026-10-01', 'INV-2026-0915', 'Overdue'],
      ['2026-11-01', 'INV-2026-0916', 'Due'],
    ])
    expect(out[0].gst).toBe(182.4)
    expect(invoicesToGenerate([...out, ...history], sub(), '2026-12-02', 8)).toEqual([])
  })
  it('skips periods already invoiced, and issues only the latest ended period with no history', () => {
    const gap = [inv('INV-2026-0900', '2026-11-01', '2026-11-30'), inv('INV-2026-0800', '2026-09-01', '2026-09-30')]
    expect(invoicesToGenerate(gap, sub(), '2026-12-02')).toEqual([])
    expect(invoicesToGenerate([], sub(), '2026-12-02').map((i) => i.periodFrom)).toEqual(['2026-11-01'])
  })
})

describe('auto-issued audit', () => {
  it('round-trips invoice numbers through the audit text', () => {
    expect([...autoIssuedNumbers([autoIssuedText('INV-2026-0915'), 'Billing contact updated'])]).toEqual(['INV-2026-0915'])
  })
})

describe('payments', () => {
  const bill = (id: string, status: InvoiceStatus, dueOn: string): TenantInvoice => ({ ...inv(`INV-${id}`, dueOn, dueOn), id, status, dueOn })
  const pay = (id: string, invoiceId: string, status: PaymentStatus, submittedOn = '2026-09-10'): PaymentSubmission => ({
    id, invoiceId, amount: 100, currency: 'MVR', method: 'Bank transfer', bank: 'BML', reference: 'FT1', paidOn: submittedOn,
    receipt: { fileName: 's.pdf', mimeType: 'application/pdf', sizeBytes: 1, storageKey: 'k' }, submittedBy: 'EMP-001', submittedOn, status,
  })

  it('shows an open invoice with a pending slip as under review, and nothing else', () => {
    const payments = [pay('p1', 'a', 'Pending verification'), pay('p2', 'b', 'Rejected'), pay('p3', 'c', 'Pending verification')]
    expect(invoiceDisplayStatus(bill('a', 'Overdue', '2026-09-01'), payments)).toBe('Payment under review')
    expect(invoiceDisplayStatus(bill('a', 'Due', '2026-09-01'), payments)).toBe('Payment under review')
    expect(invoiceDisplayStatus(bill('b', 'Overdue', '2026-09-01'), payments)).toBe('Overdue')
    // a paid invoice keeps Paid even if a stray submission is still pending
    expect(invoiceDisplayStatus(bill('c', 'Paid', '2026-09-01'), payments)).toBe('Paid')
    expect(isUnderReview(bill('d', 'Due', '2026-09-01'), payments)).toBe(false)
  })

  it('lists submissions for an invoice newest first', () => {
    const list = [pay('p1', 'a', 'Rejected', '2026-09-01'), pay('p2', 'b', 'Verified'), pay('p3', 'a', 'Pending verification', '2026-09-05'), pay('p4', 'a', 'Rejected', '2026-09-05')]
    expect(paymentsFor(list, 'a').map((p) => p.id)).toEqual(['p4', 'p3', 'p1'])
  })

  it('picks the oldest overdue invoice first, then the oldest due, skipping paid and under-review ones', () => {
    const invoices = [bill('due-old', 'Due', '2026-09-20'), bill('over-new', 'Overdue', '2026-09-15'), bill('paid', 'Paid', '2026-07-15'), bill('over-old', 'Overdue', '2026-08-15'), bill('review', 'Overdue', '2026-07-01'), bill('due-new', 'Due', '2026-09-30')]
    const payments = [pay('p1', 'review', 'Pending verification'), pay('p2', 'over-old', 'Rejected')]
    expect(payableInvoices(invoices, payments).map((i) => i.id)).toEqual(['over-old', 'over-new', 'due-old', 'due-new'])
    expect(defaultPayInvoice(invoices, payments)?.id).toBe('over-old')
    expect(defaultPayInvoice(invoices.filter((i) => i.status !== 'Overdue'), [])?.id).toBe('due-old')
    expect(defaultPayInvoice([bill('paid', 'Paid', '2026-07-15')], [])).toBeUndefined()
  })

  it('keeps slips under the tenant, per submission', () => {
    expect(receiptStorageKey('malecouncil', 'pay-1', 'slip.jpg')).toBe('tenant/malecouncil/receipts/pay-1/slip.jpg')
    expect(receiptStorageKey('malecouncil', 'pay-1', 'a/b\\c.pdf')).toBe('tenant/malecouncil/receipts/pay-1/a_b_c.pdf')
  })
})
