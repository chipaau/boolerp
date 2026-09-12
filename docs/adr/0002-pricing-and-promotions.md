# ADR 0002 — Pricing model & promotions

| | |
|---|---|
| Status | **Accepted** (2026-07-18) — Phase 1 pricing model decided; not yet implemented in this repo (roadmap component **08 Onboarding & billing** is still 🔴 Draft) |
| Deciders | Product owner + engineering |
| Supersedes | — |

> **This is the source of truth for pricing decisions.** Any change to
> pricing, discounts, or promotions must be checked against this document
> first, and any new decision must be recorded here — do not re-litigate
> settled decisions in later sessions. Ported forward from the prior
> GitLab-hosted redesign during docs consolidation; schema/requirement
> details there lived in `DB-PLATFORM.md §2a` / `FR-PLATFORM.md §10`,
> neither of which exists in this repo yet — they land as
> [`srs/phase-1/08-onboarding-billing/`](../srs/phase-1/08-onboarding-billing/)
> is expanded (currently only `checklist.md`, still 🔴 Draft). **That
> checklist's data-model touchpoints still list `coupon_codes` — P2-1 below
> already rejects coupon codes; reconcile when 08 is expanded.**

## Context

The platform sells one workspace subscription per tenant. Pricing must stay
simple enough for the small-team-first vision, undercut Odoo as the
regional benchmark, support independent price books per currency, and
later support launch/seasonal offers without cutting list prices. Phase 1
(suite tiers, multi-currency catalog) shipped 2026-07-17/18 in the prior
codebase; Phase 2 (promotions) was designed and recorded here ahead of
implementation, also not yet built in this repo.

## Phase 1 decisions

| # | Decision | Key reasoning |
|---|---|---|
| P1-1 | **Suite tiers, not per-app plans.** One subscription (Free/Standard/Premium/Enterprise) unlocks ALL apps at that tier's depth. | Per-app pricing taxed the multi-module adoption "deep integration by default" sells. |
| P1-2 | **Flat per-seat pricing; volume/seat discounts removed.** | Brackets only helped large seat counts and complicated the pricing page; big deals go to Enterprise. |
| P1-3 | ~~Multi-currency catalog keyed by currency~~ **AMENDED by P1-13 (2026-07-18)**: prices now key on the **pricelist**, not the raw currency. The principle survives intact — each price book is independent, never FX-converted ($6.99 Standard undercuts Odoo; MVR 89 set independently) — there is just one book per *pricelist* instead of per currency. | Currency keying could not express two markets sharing a currency at different prices (Odoo's core regional-pricing mechanism). |
| P1-4 | **Yearly = 10 × monthly unless overridden** (`yearly_price` NULL = derived; explicit value is the promo/rounding lever, e.g. $69.99). | One source of truth; two months free. |
| P1-5 | **`monthly_price` NULL = contact sales; 0 = free** (CHECK-enforced tier keys; free ⟺ seat-capped). | "NULL = negotiated" pattern. |
| P1-6 | **Features are a first-class entity** (`features` + `plan_features`, composite-PK pivot, graded quotas in pivot `value`). | Replaced per-plan JSON; one catalog drives pricing, entitlement, i18n. |
| P1-7 | ~~Flat per-tier workspace storage~~ **SUPERSEDED by P1-16 (2026-07-18)**: storage is unlimited on every tier and carries no cost. | Storage tiering added pricing-page complexity without being the real differentiator (features + seats are). |
| P1-8 | **The application is a quote, not a price book.** All amounts derive from the catalog (`plan_prices` × seats + GST); the application stores the priced **`lines` snapshot** at checkout and **provisioning bills exactly that snapshot, never the live catalog**. The free path has no Payment row, so the snapshot must live on the application. | Quote → pay → provision are separate moments; the catalog is mutable (and with promos, time-dependent by design). |
| P1-9 | **Frozen subscription pricing (grandfathering)**: `tenant_subscription.unit_price`/`period_amount`/`currency` freeze at purchase; entitlements track the live catalog. | Catalog changes affect new signups only. |

### Post-Phase-1 decisions (2026-07-18)

| # | Item | Status |
|---|---|---|
| P1-10 | **The frontend `COUNTRIES` registry is API-sourced from the backend** — `GET /v1/onboarding/countries` serves the registry; the website's `CountrySwitcher` fetches it through the /api proxy, and the middleware needs no registry at all (the switcher writes the country's default locale into the locale cookie only when no explicit language choice exists, preserving the localization-chain guardrail). | Implemented in the prior codebase; **not yet built here** |
| P1-11 | **Onboarding stays anonymous-first** (reaffirmed 2026-07-18 against an account-first alternative): no login before signup, the application carries owner name/email/password-hash — **no `user_id`** — and the user is created at provisioning. Revisit only when the logged-in "create another workspace" flow is built; `user_id` joins the model with that consumer. | Decided |
| P1-12 | **The application is an intake record, not a billing table** — one-shot birth certificate of a tenant; ongoing billing lives on `tenant_subscription`/`payments`. Corollary: **no speculative columns on it** — `pricelist_id` was considered for provenance and rejected (2026-07-18): nothing consumes it post-checkout; `country` + frozen `currency` + the `lines` snapshot tell the whole story. Rule: snapshot what must be re-read, derive what you can, store nothing without a consumer. | Decided |
| P1-13 | **Odoo-style regional pricelists** (supersedes the P1-3 currency keying; closes O-1). New `pricelists` table = the pricing unit: `key`, `currency` FK, `tax_percent`, `is_default` (exactly one — the rest-of-world fallback), `is_active`. `countries.pricelist_id` replaces `default_currency`; `plan_prices`/`addon_prices` re-keyed `(item, pricelist_id)`. Resolution everywhere: `country → pricelist → {prices, currency, tax}`; unknown country → default list. Adding a market = 1 pricelist row + its prices + country pointers — data, not code. Two markets sharing USD = two pricelists carrying USD. | Implemented in the prior codebase |
| P1-14 | **Tax lives on the pricelist** (`tax_percent`; closes O-2). Maldives GST is destination-based — supplies to persons outside the Maldives are **zero-rated** (MIRA G807) — so mv = 8.00, intl = 0.00. Fixes the bug of charging Maldivian GST on international USD checkouts. Global `billing.gst_percent` config removed; rates are config data, never hardcoded law. Zero-rating conditions for SaaS exports to be confirmed with the accountant. | Implemented in the prior codebase |
| P1-15 | **Applications capture the visitor's chosen country** (`onboarding_applications.country`, default `intl`, from the `bool_country` cookie; the catalog echoes the *resolved* country so an invalid cookie can never reach validation). `tenants.country` is copied from it at provisioning — the backwards USD→intl currency derivation is gone. `currency` remains on the application as the frozen snapshot of the pricing moment. | Implemented in the prior codebase |
| P1-16 | **Storage is unlimited and free on every tier** (supersedes P1-7 and removes the storage add-on). Dropped: `plans.storage_gb`, the `addons`/`addon_prices`/`tenant_addons` tables (storage packs were the ONLY add-on — empty machinery keeps no consumer, per P1-12's rule), the `tenant_storage_usage` meter + `StorageMeter` port, `Entitlements` storage pool/warn/grace logic, the storage-threshold config, and the application's `addons` jsonb. Checkout is a single plan line; tier differentiation = **features + seats** only. A future add-on system or fair-use metering is a known, bounded re-add when a real consumer exists. | Implemented in the prior codebase |
| P1-17 | **Odoo-style minimal signup** (2026-07-19): the wizard's organisation step is exactly **Company name, Email, Phone (required), Country, Language**. Removed from onboarding: the organisation-type picker, registration-document KYC, the Dhivehi name field, and the second (admin) phone. `tenants.party_type_id` is now **nullable** — self-serve tenants start unclassified; classification (and KYC where a type demands it) is a later in-app profile update or the sales-led path. The application gains `locale` → `tenants.default_locale` (the workspace opens in the chosen language); the in-form country select re-resolves the pricelist live. The phone field carries the selected country's **dial-code prefix** (`countries.dial_code`, backend-sourced; submitted numbers are stored in international format). | Implemented in the prior codebase |
| P1-18 | **Real-ISO-countries-only registry** (2026-07-19, Odoo parity): the "International" pseudo-country row is retired — **`intl` survives only as the rest-of-world PRICELIST**. The registry seeds ~196 ISO 3166-1 countries with dial codes; all map to the intl price book except Maldives (own list, dv locale, +960). Onboarding **requires an explicit country choice** (placeholder "Select country…", no preselection beyond a valid cookie); applications.country has no default. No-selection site visitors price from the default (intl) list. Re-pointing any country at its own pricelist later is one data change. | Implemented in the prior codebase |
| P1-19 | **Plan-first, branching signup paths** (2026-07-19): the wizard opens on the plan choice; the journey then branches — **free**: plan → organisation → admin → review (no workspace-address step — the address is generated — and no payment); **paid**: plan → organisation → workspace → admin → review & pay. Selecting a country later in the flow still reprices the chosen plan live. Companion fix: the status page tolerates up to 3 transient poll failures before declaring an error (a single network blip no longer strands a successfully-provisioned applicant). | Implemented in the prior codebase |
| P1-20 | **No admin step — activation-based accounts** (2026-07-19): the signing person ("Your name") is the workspace owner; their login is the **organisation email**, and **no password exists at signup**. Identity provisions the owner password-less (internal endpoint's `password_hash` now optional) and emails a signed **activation link** where the password is set (verification completes only then; re-activation of a credentialed account is a no-op). Paths shrink to free: plan → organisation → review; paid: plan → organisation → workspace → review & pay. Companions: the country dial code is the phone field's **placeholder** (a hint — numbers stored as typed, killing the double-prefix edge), and with no cookie the country is **auto-detected from the browser locale region** (client `navigator.language`, server `Accept-Language`) — the dependency-free stand-in for Odoo's IP geolocation; a GeoIP layer can come later. Also raised the onboarding rate limit to a config-driven 120/min (status polling alone is 24/min — one legitimate applicant could 429 themselves at 30). | Implemented in the prior codebase |

Promotions note: when Phase 2 (promotions) is built, **P2-4 must be re-cut against pricelists** — an
amount-kind promo scopes to a pricelist (whose currency prices it) rather than to a raw currency;
percent promos remain scope-free across lists. Re-plan that section before implementation. This
current-repo's activation flow should also be re-checked against P1-20 (password-less signup +
activation link) — component 02 (Authentication) and 08 (Onboarding & billing) both touch this.

### Phase 1 cleanup backlog (noted, deliberately NOT part of Phase 2)

- `lines` is duplicated into `payments.payload['lines']` solely for the fake
  checkout page; it could read via payment → application instead.
- Application↔payment link is bidirectional (`applications.payment_id` +
  `payload['application_id']`); `payments.application_id` alone is the more
  truthful direction (one quote, N attempts).
- `subtotal`/`gst`/`total` on applications are derivable from `lines`;
  kept for query convenience — a recorded trade, not a necessity.

## Phase 2 decisions — promotions (settled 2026-07-18)

| # | Decision | Reasoning / rejected alternative |
|---|---|---|
| P2-1 | **Automatic, window-gated promotions only. NO coupon codes, NO invite/referral codes.** The promo period (`starts_at`..`ends_at`) is the only unlock; the offer is shown on the pricing page during the window. | Coupon codes were explicitly rejected (2026-07-18): nothing for a customer to type. Odoo's own subscription discounting is automatic too; coupon codes are a *product feature* tenants may someday want for their own sales — a future module concern, not our pricing page. Removes `coupon_codes` table, validation endpoint, wizard input. |
| P2-2 | A promotion does exactly one thing: **reduce the plan line by a percent OR a fixed amount**, pre-GST. Never touches add-ons; GST is charged on the discounted subtotal. | One negative `{type: promotion}` line in the existing snapshot; `array_sum` nets it automatically. |
| P2-3 | **Promotions attach to tiers (`promotion_plans` pivot → `plans`), never to `plan_prices`.** | A percent promo is currency-agnostic — one row serves MVR + USD. Linking to price rows would force a row per currency for "20% off". Pivot (composite PK, like `plan_features`) chosen over an `applies_to_tiers` jsonb: a typo'd tier key in jsonb is a silent no-op; a `plan_id` FK makes that impossible. |
| P2-4 | **`promotions.currency`: NULL for percent, required for amount** (CHECK both ways). A two-currency amount promo = two promotion rows (e.g. `MVR 100 off` + `$6 off`). | "50 off" must say 50 of what; a percentage must not. Rejected a `promotion_prices` per-currency table as over-modelling for a case the launch promo doesn't use. |
| P2-5 | **Frozen discount = `discount_kind` + `discount_value`** on `tenant_subscription` (+ `promotion_id` provenance), recomputed against the live `period_amount` each period — **not** a computed amount snapshot. | Percent discounts must scale when seats grow (20 → 40 seats: −356 → −712 MVR). A frozen amount would silently shrink the effective percentage. |
| P2-6 | **Discount applies for as long as the workspace stays on that plan.** The window is only the *eligibility* gate, not a countdown on the customer's discount. Plan-change re-evaluation is out of scope (no upgrade flow exists yet). | No per-period countdown/expiry accounting. |
| P2-7 | **Free tier is never discounted** (never linked in `promotion_plans`); annual is a price book (P1-4), **not** a stackable discount — the earlier `stacks_with_annual` idea is dropped. Layering: `plan line − promotion → + add-ons → + GST`. | |
| P2-8 | **Overlap rule: best discount for the customer wins.** All matching live promos have `discountFor(planLineAmount)` computed; the largest applies. Promotions never stack with each other. | Deterministic, defensible, no `priority` column. Note: the winner depends on the line amount (percent beats flat at high seat counts, flat wins at low), so pricing page (representative seat) and checkout (real line) resolve through the same method. |
| P2-9 | **No redemption cap.** `max_redemptions`/`redeemed_count` dropped; the window is the only gate. `promotion_redemptions` is a pure audit/finance trail (promotion, application, tenant, amount_discounted, currency, redeemed_at), **written at provisioning (payment success)** — abandoned checkouts leave no trace. | No atomic-counter complexity; "first N signups" offers rejected for launch. |
| P2-10 | **`promotions.country` kept (NULL = global) but unused by the launch promo.** It is the only geo axis a percent promo has (its `currency` is NULL). Today it is near-inert: countries = {mv, intl} and application country is derived from currency, so for amount promos it duplicates `currency`. | Costs one nullable FK. Becomes real when applications capture actual visitor country and country packs grow — a separate, small decision worth taking for data quality on its own. |
| P2-11 | **Resolved discount is carried as typed columns** (`discount_kind`/`discount_value`/`promotion_id`) on `onboarding_applications`, in addition to the negative line in the snapshot. | Provisioning copies the frozen discount to the subscription; fishing it from jsonb by `type === 'promotion'` is fragile where a typed column is not. Deliberate, recorded duplication. |
| P2-12 | **Launch promo ships live**: seeded automatic **percent** promo on Standard + Premium, both cycles, **global** (per P2-10), dated window. Pricing page shows a banner + the **original price struck through beside the discounted current price** (reusing the annual-discount markup). Amount promos strike the plan total, not per-seat (a flat amount has no per-seat restrike). | Confirmed 2026-07-18: ship with machinery *and* a live offer, not machinery only. |

### Phase 2 schema (summary — full DDL lands with implementation)

- **New**: `promotions` (key, name/dv, kind, value, currency?, billing_cycle
  scope, country?, window, is_active), `promotion_plans` (composite PK),
  `promotion_redemptions` (audit).
- **Edited in place** (pre-launch rule): `tenant_subscription` +
  `onboarding_applications` each gain nullable `discount_kind`,
  `discount_value`, `promotion_id`.
- **Untouched**: `plans`, `plan_prices` — list prices remain the single
  source of truth; discounts compute on top.

## Consequences

- Running an offer never mutates list prices; ending one is letting the
  window lapse (or the `is_active` kill switch).
- Every discount ever granted is auditable (`promotion_redemptions`) and
  every discounted subscription knows its provenance (`promotion_id`).
- Grandfathered discounts create long-lived below-list subscriptions by
  design — the cost of an offer is visible in the redemptions trail.
- The pricing page and checkout can advertise different winning promos at
  different seat counts (P2-8); with a single live promo this never
  triggers, but it is expected behaviour, not a bug.

## Document history

| Date | Change |
|---|---|
| 2026-07-18 | Initial ADR (prior codebase): Phase 1 decisions consolidated; Phase 2 promotion decisions P2-1…P2-12 recorded from design discussion |
| 2026-07-18 | P1-10 (countries API-sourced) decided; open items O-1 (shared-currency pricing / Odoo-style pricelists) and O-2 (per-country tax) recorded with competitor research |
| 2026-07-18 | Regional pricelist redesign approved (supersedes currency keying; closes O-1/O-2). P1-11 anonymous-first reaffirmed (no user_id); P1-12 application-is-intake, pricelist_id rejected |
| 2026-07-18 | Pricelist redesign shipped: P1-13 (pricelists, re-keyed prices, country resolution), P1-14 (tax on pricelist, intl zero-rated, global gst config removed), P1-15 (country on application), P1-10 implemented (API-sourced countries registry). P1-3 amended; O-1/O-2 closed; P2-4 flagged for re-cut against pricelists |
| 2026-07-18 | P1-16: storage unlimited + free on every tier; add-on machinery and storage metering removed entirely (supersedes P1-7). Tier differentiation is features + seats only |
| 2026-07-19 | P1-17: Odoo-style minimal signup — org type/KYC/Dhivehi name/admin phone removed from onboarding; tenants.party_type_id nullable; application locale → tenant default_locale; in-form country select |
| 2026-07-19 | P1-18: real-ISO-countries-only registry (~196 seeded with dial codes); "International" pseudo-country retired (intl = pricelist only); onboarding requires explicit country choice |
| 2026-07-19 | P1-19: plan-first wizard with branching free/paid paths (free skips workspace step + payment); status-page polling tolerates transient failures |
| 2026-07-19 | P1-20: admin step removed — owner = signer, login = org email, password set at email activation (identity activation page); dial code as phone placeholder; browser-locale geo-detection; onboarding rate limit config-driven 120/min |
| 2026-09-11 | Ported forward into this repo during docs consolidation. Nothing re-decided; cross-references to `FR-PLATFORM.md`/`DB-PLATFORM.md` repointed at `srs/phase-1/08-onboarding-billing/` (not yet expanded). Flagged: that checklist still lists `coupon_codes` as a touchpoint, contradicting P2-1 |
