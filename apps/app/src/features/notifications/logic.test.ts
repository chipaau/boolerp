import { describe, expect, it } from 'vitest'
import type { NotificationRule } from '@workspace/org/types'
import type { NotificationCategory } from '@/features/shell/types'
import { NOTIFICATION_CATEGORIES, categoryForEvent, deliveredInApp, deliveryFor, preferenceFor } from './logic'
import type { NotificationPreference } from './types'

const rule = (over: Partial<NotificationRule> = {}): NotificationRule => ({
  id: 'r', eventKey: 'inventory.count_due', sourceApp: 'Inventory', event: 'Count due', recipientRoles: [], inApp: true, email: true, mandatory: false, ...over,
})
const pref = (over: Partial<NotificationPreference> = {}): NotificationPreference => ({
  personId: 'EMP-1', category: 'Stock', inApp: true, email: true, updatedOn: '2026-09-01', ...over,
})

describe('categoryForEvent', () => {
  it('maps key prefixes to categories', () => {
    expect(categoryForEvent('inventory.count_due')).toBe('Stock')
    expect(categoryForEvent('scan.device_offline')).toBe('Stock')
    expect(categoryForEvent('calendar.shift_changed')).toBe('Meetings')
    expect(categoryForEvent('approvals.waiting')).toBe('Approvals')
    expect(categoryForEvent('procurement.po_sent')).toBe('Orders')
    expect(categoryForEvent('billing.invoice_overdue')).toBe('Billing')
    expect(categoryForEvent('controlcentre.site_paused')).toBe('Setup')
  })
  it('falls back to Setup for unknown prefixes', () => {
    expect(categoryForEvent('mystery')).toBe('Setup')
  })
  it('lists every category once', () => {
    expect(new Set(NOTIFICATION_CATEGORIES.map((c) => c.category)).size).toBe(6)
  })
})

describe('preferenceFor', () => {
  it('matches person and category', () => {
    const prefs = [pref(), pref({ personId: 'EMP-2' }), pref({ category: 'Orders' })]
    expect(preferenceFor(prefs, 'EMP-1', 'Orders')).toBe(prefs[2])
    expect(preferenceFor(prefs, 'EMP-3', 'Stock')).toBeUndefined()
  })
})

describe('deliveryFor — the matrix', () => {
  const bools = [true, false]
  const prefs: (boolean | undefined)[] = [true, false, undefined]
  for (const mandatory of bools)
    for (const orgOn of bools)
      for (const prefOn of prefs)
        it(`org ${orgOn ? 'on' : 'off'} · pref ${prefOn === undefined ? 'missing' : prefOn ? 'on' : 'off'} · ${mandatory ? 'mandatory' : 'optional'}`, () => {
          const r = rule({ inApp: orgOn, email: orgOn, mandatory })
          const p = prefOn === undefined ? undefined : pref({ inApp: prefOn, email: prefOn })
          const expected = mandatory || prefOn === undefined ? orgOn : orgOn && prefOn
          expect(deliveryFor(r, p)).toEqual({ inApp: expected, email: expected })
        })

  it('narrows channels independently', () => {
    expect(deliveryFor(rule(), pref({ inApp: true, email: false }))).toEqual({ inApp: true, email: false })
    expect(deliveryFor(rule({ email: false }), pref({ inApp: false, email: true }))).toEqual({ inApp: false, email: false })
  })
  it('never turns on a channel the organisation has off', () => {
    expect(deliveryFor(rule({ inApp: false, email: false }), pref())).toEqual({ inApp: false, email: false })
  })

  describe('personal events (no rule)', () => {
    it('deliver in-app only by default', () => {
      expect(deliveryFor(undefined, undefined)).toEqual({ inApp: true, email: false })
    })
    it('follow the in-app preference, never email', () => {
      expect(deliveryFor(undefined, pref({ inApp: false }))).toEqual({ inApp: false, email: false })
      expect(deliveryFor(undefined, pref({ inApp: true, email: true }))).toEqual({ inApp: true, email: false })
    })
  })
})

describe('deliveredInApp', () => {
  type N = { id: string; eventKey: string; recipientIds: string[]; category: NotificationCategory }
  const list: N[] = [
    { id: 'stock', eventKey: 'inventory.count_due', recipientIds: ['EMP-1'], category: 'Stock' },
    { id: 'other', eventKey: 'inventory.count_due', recipientIds: ['EMP-2'], category: 'Stock' },
    { id: 'invite', eventKey: 'meetings.invite', recipientIds: ['EMP-1'], category: 'Meetings' },
    { id: 'overdue', eventKey: 'billing.invoice_overdue', recipientIds: ['EMP-1'], category: 'Setup' },
  ]
  const rules = [rule(), rule({ id: 'o', eventKey: 'billing.invoice_overdue', mandatory: true })]

  it('is empty without a person', () => {
    expect(deliveredInApp(list, rules, [], undefined)).toEqual([])
  })
  it('keeps what is addressed to me and marks email from the rule', () => {
    expect(deliveredInApp(list, rules, [], 'EMP-1').map((n) => [n.id, n.emailed])).toEqual([['stock', true], ['invite', false], ['overdue', true]])
  })
  it('applies category preferences, using the rule category for ruled events and the notification category otherwise', () => {
    const prefs = [pref({ email: false }), pref({ category: 'Meetings', inApp: false }), pref({ category: 'Billing', inApp: false, email: false })]
    expect(deliveredInApp(list, rules, prefs, 'EMP-1').map((n) => [n.id, n.emailed])).toEqual([['stock', false], ['overdue', true]])
  })
  it('drops ruled events muted in-app', () => {
    expect(deliveredInApp(list, rules, [pref({ inApp: false })], 'EMP-1').map((n) => n.id)).toEqual(['invite', 'overdue'])
  })
})
