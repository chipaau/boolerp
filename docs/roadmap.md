# Roadmap

## Phase 1 — Foundation (identity, tenancy, authz, observability)

Everything a business module needs before it can exist. No IMS/HRMS/Procurement/Performance until
Phase 1 is `Confirmed`.

| # | Component | Purpose | Status |
|---|---|---|---|
| 01 | Platform foundation | Chi skeleton, config, RLS `WithTenant`, `/bootstrap`, seeding, **docker/compose unit**, **self-host first-run** | 🟡 In Review |
| 02 | Authentication & sessions | Ory Kratos: password + MFA + passkeys + OIDC, `whoami` validation, session revocation; custom UI in apps/app | 🟢 Confirmed |
| 03 | Identity & membership | Global `users` (= Kratos subject), `tenant_users`, invites, owner, seat tracking (enforce P2) | 🟡 In Review |
| 04 | Tenant management | Lifecycle, provisioning engine, hierarchy (ltree/`tree_key`), **visibility: auto-subordinate + mutual-affiliated (hierarchy-bounded)**, suspension | 🟡 In Review |
| 05 | Authorization (Cerbos) | Cerbos PDP integration + role/capability/user-role **administration**; internal/operator-tenant model; four-eyes + support-access grants | 🟡 In Review |
| 06 | Audit | `audit_log` auto-capture (changed-cols + snapshot-on-delete), immutability, ≥7y retention | 🟡 In Review |
| 07 | Observability | Distributed tracing (OpenTelemetry), structured logging, correlation IDs, metrics, health; stdout-default self-host | 🟡 In Review |
| 08 | Onboarding & billing | Website self-serve (Odoo-style): plans/pricelists, subscriptions, payment gateway (fake driver → BML), coupons, provisioning trigger + seat enforcement. **Sequenced last; SaaS-only; on-prem sales-gated.** | 🔴 Draft |

> **Scope note:** components **01**, **03**, the **visibility model in 04**, and **08 Onboarding & billing**
> (pulled in 2026-08-13 — self-serve website onboarding in Phase 1) are additions beyond the
> initially-listed five (auth, tenant mgmt, permission, tracing, audit).
>
> **UI homes:** tenant-facing foundation surfaces (own users, roles, org units, sites, settings) live in
> the **Control Centre** module of `apps/app`. Operator-facing surfaces (provisioning, suspension,
> impersonation, cross-tenant) live in **`apps/admin`**.
>
> **Process:** every component follows **Idea → Expansion → Review → Implementation**; every use case
> ships with **unit + integration + Playwright e2e** tests (see `README.md` + `.claude/rules/testing.md`).

## Phase 2+ (not now)

- Real payment gateway (**BML/MPGS**) swapped in behind the port; recurring billing / renewals / invoicing.
- Business modules, in order: **IMS → HRMS → Procurement → Performance** (each its own confirmed SRS + DB model).

## Orphaned platform topics — proposed placement (pending review)

Docs consolidation (2026-09-11) surfaced platform-level topics from the prior codebase's
`DB-PLATFORM.md` that don't map to any line above. Proposed placements below — **none of these are
decided**; they need the same explicit sign-off as a new roadmap line or table.

| Topic | Prior tables | Proposal | Why |
|---|---|---|---|
| **Module activation** | `module_activations`, `module_admins` | Already placed — component **06 (Audit)**/foundation, per `data-model/DB-FOUNDATION.md`'s deferred list. `module_admins` isn't explicitly named there; piggyback it on the same landing. | No new decision needed, just confirming it's tracked. |
| **Sites** | `site_types`, `site_categories`, `sites`, `org_unit_sites` | New Phase 1 component — **09 Sites & locations**, sequenced after 04 (Tenant management). | Physical locations are tenant-scoped infrastructure every business module needs (IMS storage points, HRMS device sites) — fits Phase 1's own "everything a business module needs before it can exist" framing, not tenant lifecycle itself. |
| **Party registry** | `parties` (party_types/classification already ✅ in DB-FOUNDATION) | Defer to Phase 2 — first module that needs it (likely HRMS employee-as-party or Procurement supplier-as-party) defines its initial shape. | No Phase 1 component currently needs a generic party master record; `users`/`tenant_users` already cover human identity. Forcing it into Phase 1 speculatively risks the wrong shape. |
| **Workflow engine** | `workflow_definitions`, `workflow_instances`, `workflow_steps` | **Open — needs a real decision, not a default.** Option A: new Phase 1 component (approval chains are load-bearing for nearly every Phase 2 module). Option B: Phase 2, first module (Procurement PR approval, or HRMS leave approval) builds its own, extracted into a shared engine once a second consumer exists. | This is the biggest-scope item here — a generic workflow engine is substantial work; deferring risks each module reinventing approval chains, building early risks over-engineering before there's a second real consumer. |
| **Documents & numbering** | `document_templates`, `documents`, `numbering_series` | Defer to Phase 2. | The gapless-numbering *invariant* is already documented (`.claude/rules/tenancy.md`); the tables themselves aren't needed until something issues numbered documents (invoices, POs, IUL letters) — and invoicing itself is already Phase 2+ per this roadmap. |
| **Notifications** | `notification_templates`, `notification_log` | Defer to Phase 2, with a note: component 05's four-eyes approval flows (role-change proposals, access grants) may want a Phase 1 notification stub sooner than the business modules do. | Kratos's own courier already covers auth-related mail (component 02); generic in-app/SMS notification infra is otherwise business-module-driven. |
