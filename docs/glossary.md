# Glossary

| | |
|---|---|
| Status | Ported from the prior GitLab-hosted redesign; entries tied to schema-per-tenant corrected |
| Version | 0.2 |
| Date | 2026-09-11 |

| Term | Meaning |
|---|---|
| **A-number** | Maldivian national identity card number (e.g. `A123456`). |
| **Acting appointment** | A temporary assignment carrying a position's authority while the substantive holder is away; approvals follow it automatically. |
| **Assignment** | The binding of a person to a position for a period (`permanent`/`acting`/`temporary`). |
| **Atoll / Island / Ward** | Maldives administrative geography, centrally versioned reference data (e.g. `HDh.` / Kulhudhuffushi / Ward 3). |
| **Audit pack** | One exported PDF bundle containing a procurement case's full evidence chain (PR → award → PO → GRNs). |
| **Buffer site** | A consumption point (`storage_mode = buffer`) — nurse station, service counter. Consumes stock, self-initiates replenishment, never supplies. |
| **Catalog adoption** | A child tenant deep-copying a parent's item template (with reference resolution) into its own catalog; soft lineage, no auto-propagation. |
| **Capability** | Authorization grant slug `{module}:{resource}:{action}`; functional levels `view` and `manage`. |
| **Carry-forward** | Unused leave moved into the next leave year, up to a configured cap. |
| **Cerbos** | The policy-as-code authorization engine behind the platform's authorization decisions (component 05). |
| **Clock-pause** | SLA turnaround intervals excluded while a request awaits requester documents or sits returned-for-correction. |
| **CSC** | Civil Service Commission — Bool exports CSC-format reports; statutory records stay in CSC systems. |
| **Custody** | The acknowledged assignment of an asset to an employee or org unit. |
| **Dhivehi / Thaana** | The Maldivian language / its right-to-left script — first-class throughout the product. |
| **eFaas** | The Maldives national digital identity SSO (planned identity federation). |
| **Establishment** | The official list of posts (positions) an organisation is approved to have. |
| **FEFO** | First-Expired-First-Out issue ordering for expiry-tracked stock. |
| **Four-eyes** | No access grant takes effect on one person's say-so — every proposal (including a module admin's) needs a distinct approver. |
| **Goods Request** | A demand-driven request for items where the system — not the requester — resolves fulfilment: issue from stock, or auto-raise a PR for the shortfall. |
| **Inter-tenant stock request** | A child tenant sourcing goods from an ancestor provider tenant (per classification config); bilateral ledger entries with notional cost, no invoice. |
| **Internal tenant** | The single `is_internal` tenant (Bool itself). Staff are ordinary members of it; only `platform:*` capabilities held there act platform-wide. See `.claude/rules/auth.md`/`tenancy.md` and [ADR history](adr/history/0001-schema-per-tenant.md) (the operator-model concept, unlike the storage model, survived the tenancy reversal unchanged). |
| **Support-access grant** | A time-boxed, audited authorization letting an operator read a tenant's operational data — internal membership alone never grants data access. |
| **Item classification** | The regulatory/handling axis of an item (GEN, MED, MED-CTRL, CHEM, FOOD, EQUIP, ASSET) carrying the request tier and handling notes — orthogonal to category. |
| **GRN** | Goods Received Note — the receiving document that triggers stock-in/asset intake. |
| **IUL** | Prefix convention for government outgoing-letter numbering, e.g. `(IUL)426-AB/426/2026/15`. |
| **Method engine** | The rule that recommends a procurement method from tenant value bands; overridable with recorded justification. |
| **MIRA / GST TIN** | Maldives Inland Revenue Authority / its tax identification number for businesses. |
| **Movement** | An immutable ledger row (stock, leave) from which balances are projected — never edited, only appended. |
| **Module admin** | The designated per-tenant administrator(s) of one module — runs its onboarding wizard and settings; assigned at activation. |
| **Onboarding application** | A website signup in flight — Odoo-style minimal organisation details (name, email, phone), seats, chosen tier, country, workspace language, owner account, and the priced lines snapshot. The only record that exists until payment clears and provisioning succeeds. No org type or KYC at the gate ([ADR 0002](adr/0002-pricing-and-promotions.md) P1-17). |
| **Seat** | One committed (prepaid) member slot in a workspace — every member, including invited ones, occupies a seat. `tenants.seats` is the hard cap. Seat pricing is flat (no volume discounts). |
| **Tier** | The workspace's suite subscription level (Free/Standard/Premium/Enterprise). ONE tier unlocks ALL apps at that tier's depth, setting the flat per-seat rate and feature entitlements. Storage is unlimited on every tier. Free is ≤5-seat workspaces only; Enterprise is contact-sales. |
| **Feature** | A first-class capability catalog entry (`features` table): a gate key (or a display-only marketing line when null), an owning app (or workspace-level), and a kind (boolean or graded limit). `plan_features` maps which tier includes each feature and its quota `value`. |
| **Pricelist** | The regional pricing unit (Odoo-style): each pricelist owns its currency, its tax rate, and one independent price book — never an FX conversion. Countries map to a pricelist; the visitor's country resolves prices, currency, and GST through it (unknown country → the default International list). Two markets sharing a currency can price apart via two pricelists. |
| **Currency** | The money a checkout is charged in — a property of the resolved pricelist, frozen onto the application/subscription/payment at pricing time. A `currencies` reference row supplies the money-formatting metadata (symbol, decimals, position). |
| **Oversight** | The kind of a tenant hierarchy edge: `subordinate` (parent has line authority → automatic aggregate visibility) or `affiliated` (structural link only → all visibility explicit). Derived from party types (gov→gov = subordinate), overridable. |
| **Notional cost** | The unit cost recorded on stock-ledger entries for reporting (network cost visibility) — never a financial transaction. |
| **Request tier** | The cumulative clearance level (`open`→`standard`→`operational`→`certified`→`licensed`→`controlled`) a classification demands of requesters; Cerbos matches it against principal attributes. |
| **Orphan work** | Activities/tasks linked to no strategy — reported, never blocked. |
| **Outbox** | The transactional table through which domain events publish, keeping event and data change atomic. |
| **Party** | A person or organisation master record in the platform registry — one identity across modules. Not yet modelled in this repo (see the orphaned-topics review in `roadmap.md`). |
| **Party type** | The hierarchical classification of a party/tenant (Individual→Local…, Organisation→Government→Council…) carrying `allowed_identity_types` and the provisioning `template_key`. Roots are structural anchors only. Implemented — see `data-model/DB-FOUNDATION.md`. |
| **PFR** | Public Finance Regulation — source of procurement value bands and methods (tenant config, not hard-code). |
| **Position (post)** | An established post with number, title, grade; authority attaches here, not to people. |
| **PR / PO** | Purchase Request / Purchase Order. |
| **Ramadan hours** | The reduced official working hours during Ramadan, switched automatically from the central calendar. |
| **RBM** | Results-Based Management — the Plan → Focus Area → Objective → Strategy → Outcome → Indicator hierarchy. |
| **Return-for-correction** | A workflow action sending a document back to its author; pauses SLA clocks where configured. |
| **SAP** | Strategic Action Plan — ministry vocabulary for the RBM plan (councils: Development Plan; private: Strategic Plan). |
| **Service charter** | The published catalog of services with SLA commitments in working days. |
| **Site** | A physical location (Platform-owned) whose **site type** carries the `storage_mode` policy (`none`/`buffer`/`transit`/`storage`); only leaf sites hold stock. Not yet modelled in this repo (see the orphaned-topics review in `roadmap.md`). |
| **SKU (item)** | One concrete variant of a template — the unit stock is tracked at ("Galaxy S25 Ultra 256GB Titanium Black"). |
| **Supply chain (IMS)** | The configured delivery-site → supply-site priority mapping; unconfigured sites fall back to the nearest storage ancestor. |
| **Template (item)** | The product-level catalog entry ("what it is") declaring which attributes vary; every SKU belongs to one. |
| **SLA** | Service Level Agreement — turnaround commitment, computed working-day aware with clock-pauses. |
| **Tenant** | One customer organisation: its own subdomain, row-scoped data (pooled tables + `tenant_id`, enforced by Postgres RLS — see [ADR 0001](adr/0001-tenancy-pooled-rls.md)), config, and users. |
| **Value band** | A PFR amount range mapping to a procurement method (direct / quotations / tender). |
| **Visibility grant** | A scoped, time-bounded permission letting a parent tenant see child data (aggregate by default). Auto-created (`source: hierarchy`) for subordinate children; otherwise explicit and child-authorised. Implemented as `tenant_visibility_grants` — see `.claude/rules/tenancy.md`. |
| **Working day** | Sunday–Thursday excluding holidays from the applicable calendar — the unit of SLA and leave arithmetic. |

## Document history

| Version | Date | Summary |
|---|---|---|
| 0.1 | 2026-07-15 | Initial draft (prior codebase) |
| 0.2 | 2026-09-11 | Ported into this repo during docs consolidation. Removed **Fleet migration** (schema-per-tenant-only concept, no longer applicable under pooled+RLS — ordinary Goose migrations apply once). Corrected **Tenant**, **Internal tenant**; annotated **Party**/**Site** as not yet modelled here |
