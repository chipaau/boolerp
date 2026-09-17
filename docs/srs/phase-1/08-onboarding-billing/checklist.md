# 08 — Onboarding & Billing — Confirmation Checklist

**Status:** 🟡 UI on fixtures; backend not started (billing slice, 2026-09-17) &nbsp;·&nbsp; Billing spec:
[`srs.md`](srs.md) + [`use-cases.md`](use-cases.md) (UC-BIL-01…10); data model
[`DB-BILLING.md`](../../../data-model/DB-BILLING.md) (🟡 proposed, table-by-table pending). Fixture UI:
Control Centre → Billing & plan (`apps/app/src/features/control-centre/billing-page.tsx`, `billing-pay.tsx`,
`apps/app/src/features/billing/{types,logic,mock,queries}.ts`). Admin console billing screens not built.
Self-serve onboarding (UC-ONB-*) remains 🔴 Draft &nbsp;·&nbsp; Pulled into Phase 1 (2026-08-13). **Sequenced last** (depends on
03/04/05). **SaaS self-serve only**; on-prem is sales-gated.

## Scope
- **In:** website self-serve onboarding (Odoo-style: plan → application → pay → **auto-provision** via 04);
  plans + regional pricelists; subscriptions; **payment gateway behind a port (fake driver in P1, BML/MPGS
  later)**; coupons/promotions; **seat enforcement** (the bit deferred from 03 lands here).
- **Out:** on-prem provisioning (sales-gated → operator, 04); business modules.

## Candidate use cases
- UC-ONB-01 — Visitor completes self-serve signup (application) on the website
- UC-ONB-02 — Payment via gateway (fake driver) → on success the provisioning job runs (→ UC-TEN-02)
- UC-ONB-03 — Zero-total (all-free) signup skips the gateway
- UC-ONB-04 — Coupon/promotion applied at checkout
- UC-ONB-05 — Subscription created; seat commitment recorded
- UC-ONB-06 — On-prem "contact sales" lead captured (hand-off, not self-serve)
- UC-ONB-07 — Provisioning failure tears down cleanly (no squatted slug)
- UC-ONB-08 — Seat **enforcement**: over-seat invite blocked (activates the 03-deferred rule)

- UC-BIL-01…10 — invoices, overdue, plan change requests, bank-transfer slips + operator verification (see `use-cases.md`)

## ⚠️ Likely-missing / confirm
- Payment gateway: fake driver in P1, real BML/MPGS later — confirm. *(Billing slice pays by bank transfer + slip; no gateway, no card data.)*
- ~~Renewal / recurring billing / invoicing in P1 or later?~~ → automatic invoicing specified (UC-BIL-01).
- Which tiers/features at launch (mirror `erp` plans)?

## Open questions
- [ ] Payment gateway approach (fake driver P1 + BML later)?
- [x] Recurring invoicing in P1 → yes, bank transfer + operator verification (UC-BIL-*).
- [ ] DB-BILLING Q1–Q8 and the srs.md open items.
- [ ] Launch tiers/features set?

## Data-model touchpoints
- Billing group (C): `apps`, `plans`, `plan_prices`, `features`, `plan_features`, `tenant_subscription`,
  `promotions`, `coupon_codes`, `payments`, `onboarding_applications`. *(Unconfirmed candidate names.)*
- Billing slice (🟡 proposed in `DB-BILLING.md`, **not approved**): `subscriptions`, `billing_contacts`,
  `tenant_invoices`, `plan_change_requests`, `payment_submissions`; plus ⚠️ `tenant_invoice_lines` and
  ⚠️ `invoice_number_counters` (not in the approved shapes — need explicit approval). `tenant_subscription`
  and `payments` above are superseded by `subscriptions` / `payment_submissions` if those are approved.

## Sign-off
- [ ] Scope confirmed &nbsp; [ ] Open questions resolved &nbsp; [ ] Use-case inventory complete &nbsp; [ ] Data model confirmed
