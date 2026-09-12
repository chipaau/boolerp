# Product Overview

| | |
|---|---|
| Status | Ported from the prior GitLab-hosted redesign; tenancy section rewritten for pooled+RLS |
| Version | 0.2 |
| Date | 2026-09-11 |

> **A note on "Phase 1":** this document's original "Phase boundaries" section (§6) used "Phase 1"
> to mean *the five business modules* (Platform, HRMS, Procurement, IMS, Performance). This repo's
> [`roadmap.md`](roadmap.md) now uses "Phase 1" to mean *foundation only* — auth, tenancy, authz,
> audit, observability, onboarding & billing — with all five business modules pushed to Phase 2+.
> §6 below is corrected to match; nothing else in the vision or module map changed.

## 1. What Bool ERP is

A multi-tenant ERP platform for **councils, health centres, ministries, and
private companies**, launching in the **Maldives**. Four differentiators
drive every design decision:

1. **Hierarchical central tenant management** — a parent organisation
   (Ministry of Health) oversees many child tenants (island health centres)
   with aggregate reporting and policy push-down, while each tenant stays
   operationally autonomous.
2. **Deep integration by default** — modules communicate through versioned
   domain events and a shared entity registry; cross-module flows
   (PR → PO → GRN → stock-in → asset register) work with zero configuration.
3. **Localization depth** — Thaana/Dhivehi (RTL) as a first-class language,
   Sunday–Thursday working week, Ramadan hours, Maldives leave types,
   atoll/island/ward geography, eFaas login, Auditor-General-ready reports.
4. **No-consultant onboarding** — opinionated defaults per organisation
   type, guided setup wizards, Excel import for existing data.

## 2. Actors

| Actor | Description | Example |
|---|---|---|
| **Staff** | Any employee using self-service (leave, attendance, tasks, requests) | A nurse at Hulhumalé Hospital requesting annual leave |
| **Officer** | Operates a module day-to-day (HR officer, procurement officer, storekeeper) | Addu City Council's procurement officer creating an RFQ |
| **Approver** | Holds approval authority through a **position** (incl. acting) | Council Secretary-General approving a PO |
| **Committee member** | Sits on an evaluation/disposal committee | Bid committee scoring quotations |
| **Executive** | Consumes dashboards, signs off plans | Council President reviewing SLA compliance |
| **Parent-org analyst** | Views aggregate child-tenant data under an explicit grant | Ministry planner comparing health-centre KPIs |
| **Tenant admin** | Configures the tenant: org structure, leave types, value bands, vocabulary — the **Control Centre** module of `apps/app` | Council's senior admin officer |
| **Operator** | Bool staff running the platform via `apps/admin` | Provisioning a new tenant |
| **System** | Background actors: device-sync (biometric), notifier (SMS), scheduler | Nightly SLA recomputation |

## 3. Tenancy model (summary)

- **Pooled tables + Postgres Row-Level Security**, grain `tenant_id` only — see
  [ADR 0001](adr/0001-tenancy-pooled-rls.md) and [`.claude/rules/tenancy.md`](../.claude/rules/tenancy.md)
  for the full decision and mechanics. *(This section previously described schema-per-tenant —
  that model was reversed 2026-08-13; see the ADR for why.)*
- Tenant resolution by subdomain (`malecouncil.bool.test` in dev); the API validates the session via
  Kratos `whoami` and resolves the tenant from the trusted, proxy-forwarded Host on every request —
  the URL routes, it is never the security boundary.
- Tenant hierarchy is a tree (adjacency `parent_id` + `path ltree` + immutable `tree_key`). **Parent
  access to child data is an explicit, auditable visibility grant** (aggregate-level by default,
  auto-granted for `subordinate` oversight, explicit for `affiliated`) — never implicit.
- Full detail: [`data-model/DB-FOUNDATION.md`](data-model/DB-FOUNDATION.md) — currently covers the
  Phase 1 foundation tables (reference/classification data, identity, tenancy, authorization);
  registry/parties, sites, workflow, documents, and notifications are not yet modelled here (see the
  orphaned-topics review in [`roadmap.md`](roadmap.md)).

## 4. Module map & ownership

| Module | Owns | Consumes (via contracts/events) |
|---|---|---|
| **Platform** | Tenancy, identity/RBAC, party registry, **sites** (physical locations w/ storage modes), workflow engine, documents/PDF, notifications, audit, event bus, **module activation + delegated access** | — |
| **HRMS** | Org units, positions, assignments, employees, attendance, leave | Platform workflow, sites (devices), documents, notifications |
| **Procurement** | Suppliers, PRs, sourcing, POs, GRNs | Inventory item catalog (contract), HRMS positions (committees/approvers), Platform workflow |
| **Inventory & Assets (IMS)** | Item catalog (template→SKU, classifications w/ request tiers), goods requests, buffer consumption, supply chains, stock ledger, **inter-tenant stock**, catalog adoption, asset register/custody/verification/disposal | Platform sites, Procurement GRN events, HRMS employees (custody) |
| **Performance** | Strategic/operational plans, KPIs, service charter/SLA, tasks & activities | HRMS org units + employees (responsibility/assignment), Platform workflow |

Cross-module rules: no cross-module joins ever; shared concepts have one owner; balances are
projections of immutable movement records; every write is audited.

> **Status:** none of these five modules has started SRS/DB expansion in this repo yet — they're
> Phase 2+ per the current roadmap. Draft requirements/data-model/user-stories from the prior
> codebase exist as unvalidated prior art (written under the schema-per-tenant model) — see the
> orphaned-topics review in [`roadmap.md`](roadmap.md) for what to do with them.

## 5. Key integration flows (event-driven, zero-config)

1. **Procure-to-stock**: PR approved → method engine → quotes/committee →
   PO issued → GRN posted → `procurement.grn.received.v1` →
   Inventory records stock-in; asset-class items also create asset-register
   drafts.
2. **Leave lifecycle**: request → workflow (position-based approvers) →
   approval → `hrms.leave.approved.v1` → attendance expectations adjust,
   balance projection updates, notification (in-app/SMS).
3. **Service charter**: citizen/internal request logged →
   SLA clock (working-day aware, clock-pause on awaiting-documents) →
   turnaround computed → compliance dashboards.
4. **Plan-to-work**: strategy → activities → tasks; progress rolls up to
   KPIs; orphan-work report surfaces unlinked effort.
5. **Demand-to-fulfilment**: staff raise a Goods Request without knowing
   stock; lines fulfil from supply-chain stock or auto-raise PRs for
   shortfalls; buffer sites consume and self-replenish.
6. **Central procurement**: an island health centre sources medicines from
   its atoll hospital via inter-tenant stock requests — bilateral ledger
   entries with notional cost, no invoices — while buying general supplies
   itself.

## 6. Phase boundaries

Per the current [`roadmap.md`](roadmap.md): **Phase 1 is foundation only** — everything a business
module needs before it can exist (auth, tenancy, authorization, audit, observability, and
self-serve onboarding & billing). **None of the five modules above are in Phase 1.** Phase 2+
builds them in order: **IMS → HRMS → Procurement → Performance**, each with its own confirmed SRS
and DB model. Deferred beyond that: payroll, finance/budget engine, depreciation GL, citizen
portal, recruitment, appraisal scoring, CLM, e-bidding. Where a Phase 2 module touches a
still-deferred area (e.g. PR budget line), store a **coded reference, not behaviour**.

## Document history

| Version | Date | Summary |
|---|---|---|
| 0.1 | 2026-07-15 | Initial draft (prior codebase) |
| 0.2 | 2026-09-11 | Ported into this repo during docs consolidation. §3 tenancy rewritten for pooled+RLS (ADR 0001); §6 corrected for this repo's "Phase 1 = foundation only" meaning; §4 annotated with current module-expansion status |
