# erp docs

Confirmation-driven specs. **Nothing is implemented until its use cases and data model are
`Confirmed`** (see `.claude/rules/conventions.md`).

## Structure

- `overview.md` — product vision, actors, module map, integration flows.
- `glossary.md` — domain terminology across all modules.
- `roadmap.md` — phases and per-component status.
- `adr/` — architecture decision records (`0001-tenancy-pooled-rls.md`, `0002-pricing-and-promotions.md`, …).
  `adr/history/` holds superseded decisions kept for context, outside this repo's ADR sequence.
- `data-model/` — `DB-*.md` (tables, columns, constraints). Confirmed before any migration.
- `srs/phase-<n>/<NN-component>/` — per component:
  - `checklist.md` — scope, open questions, candidate use-case inventory, sign-off. Drives
    "refine until confirmed."
  - `srs.md` — functional requirements (written once the checklist's open questions are resolved).
  - `use-cases.md` — detailed use cases (`UC-<AREA>-<n>`) (written once scope is confirmed).

## Workflow: Idea → Expansion → Review → Implementation

1. **Idea** — the component exists as a `roadmap.md` entry.
2. **Expansion** — write `checklist.md` (scope, open questions, candidate use-case inventory — flag
   likely-missing), then `srs.md` + `use-cases.md`, and the `data-model/DB-*.md` it touches.
3. **Review** — resolve every open question with the user; status → 🟢 Confirmed. **Nothing is built before this.**
4. **Implementation** — build strictly to the confirmed docs, with full tests; status → ✅ Implemented.

## Status legend

- 💡 **Idea** — roadmap entry, not yet expanded.
- 🔴 **Draft** — being expanded; open questions unresolved.
- 🟡 **In Review** — expanded; awaiting sign-off.
- 🟢 **Confirmed** — approved; ready to implement.
- ✅ **Implemented** — built + tested (100% use-case coverage + Playwright e2e passing).

## Definition of Done (per use case)

Done only when: implemented to spec · **unit + integration (Testcontainers) + Playwright e2e** pass ·
cross-tenant isolation test present (if tenant-scoped) · docs match the code. See
[`.claude/rules/testing.md`](../.claude/rules/testing.md).

> Reminders: surface **missing/ambiguous use cases** for explicit confirmation rather than assuming.
> `docs/` is **authoritative** — implement only what's Confirmed (see `.claude/rules/conventions.md`).
