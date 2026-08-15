# Project context

**What:** `go-erp` is a from-scratch Go rewrite of the existing Laravel **Bool ERP**. The product
is a multi-tenant ERP (inventory/IMS, HRMS, procurement, performance, …) sold as global SaaS and
also self-hostable by a single institution (e.g. a ministry) that runs it for itself and its
subordinate facilities.

**Clients:** Maldivian government (councils, ministries, health facilities), plus private
companies. Regulated / institutional-trust posture — audit, per-tenant data lifecycle, and
prompt access revocation matter.

**Deployment (dual target, one codebase):**
- **SaaS:** many tenants, regional clusters for residency, operator-provisioned (not self-serve at scale).
- **Self-hosted:** one institution + its sub-tenants on their own box, operated by non-experts.
  Optimize for *one artifact, one migration command, minimal moving parts.*

**Tenant counts** are bounded (hundreds to low thousands of paying institutions), never millions.

## Decisions locked

1. **Isolation model: pooled + Postgres RLS** (2026-08-13) — reverses `../erp`'s schema-per-tenant.
   See `tenancy.md`.
2. **Grain: `tenant_id` only** — no `company_id`; multi-entity = the tenant hierarchy. See `tenancy.md`.

Next order of work: write go-erp **ADR 0001** (tenancy, mirroring the `../erp` ADR format) →
**confirm the tenancy-spine table DDL** (`tenants`, `tenant_users`, `tenant_visibility_grants`,
`users`, roles) per the data-model rule → scaffold the `docker/` unit + minimal Chi skeleton.
