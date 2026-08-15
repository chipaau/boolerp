# 08 — Onboarding & Billing — Confirmation Checklist

**Status:** 🔴 Draft &nbsp;·&nbsp; Pulled into Phase 1 (2026-08-13). **Sequenced last** (depends on
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

## ⚠️ Likely-missing / confirm
- Payment gateway: fake driver in P1, real BML/MPGS later — confirm.
- Renewal / recurring billing / invoicing in P1 or later?
- Which tiers/features at launch (mirror `erp` plans)?

## Open questions
- [ ] Payment gateway approach (fake driver P1 + BML later)?
- [ ] Renewal/recurring billing in P1, or initial purchase only?
- [ ] Launch tiers/features set?

## Data-model touchpoints
- Billing group (C): `apps`, `plans`, `plan_prices`, `features`, `plan_features`, `tenant_subscription`,
  `promotions`, `coupon_codes`, `payments`, `onboarding_applications`.

## Sign-off
- [ ] Scope confirmed &nbsp; [ ] Open questions resolved &nbsp; [ ] Use-case inventory complete &nbsp; [ ] Data model confirmed
