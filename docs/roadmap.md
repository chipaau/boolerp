# Roadmap

## Phase 1 — Foundation (identity, tenancy, authz, observability)

Everything a business module needs before it can exist. No IMS/HRMS/Procurement/Performance until
Phase 1 is `Confirmed`.

| # | Component | Purpose | Status |
|---|---|---|---|
| 01 | Platform foundation | Chi skeleton, config, RLS `WithTenant`, `/bootstrap`, seeding, **docker/compose unit**, **self-host first-run** | 🟡 In Review |
| 02 | Authentication & sessions | Ory Kratos: password + MFA + passkeys + OIDC, `whoami` validation, session revocation; custom UI in apps/app | 🟡 In Review |
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
