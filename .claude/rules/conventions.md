# Conventions & working agreement

## How to collaborate on this repo

- **Be critical; don't just agree.** Push back when a request is wrong, when there's a better
  option, or when there's a security concern. Always reason about edge cases.
- **Verify claims with tools** (docs, code, web) rather than asserting from memory; the user checks.
- **Design stage: do not create implementation files, migrations, or scaffolding without explicit
  confirmation.** Proposals and inline examples are fine; writing project code is not, until asked.
- **Always confirm the data model before it exists anywhere — no exceptions.** Any schema (new
  tables/columns, keys, indexes, relationships, enums, migrations) must be presented (tables, types,
  constraints, relationships) and **explicitly approved** before it's written into **a migration,
  sqlc query, application code (types, mocks, seed/fixture data) — or documentation** (`DB-*.md`,
  `srs.md`, `checklist.md`, `use-cases.md`, an ADR, a roadmap line). Confirm it **table-by-table**.
- **NEVER introduce a new table without the user's explicit assertion — including in docs.** Not
  "probably fine", not "implied by the spec", not "just a placeholder in the checklist's touchpoints
  list" — every single table needs an explicit yes **before its name appears anywhere**, docs included.
  A table sitting in a checklist's "data-model touchpoints" or a draft SRS section is exactly as
  uncommitted as one in a migration — don't let it acquire the weight of "already decided" just by
  existing on the page. This overrides momentum, deadlines, and apparent obviousness. Data models are
  expensive to change once there is data. Mirror the SRS `DB-*.md` / ADR style the sibling repos use.

## Commit discipline

- **Run the affected tests locally before every `git commit`; never commit on a known-failing or
  unrun suite.** See `testing.md` for the exact commands (Docker-first, per layer) and the 100%
  coverage gate required before a PR goes up.
- **Commit whenever a coherent, commitable unit of work is done — proactively, along the way.**
  Don't let a long session accumulate into one giant diff that only gets committed when the user
  remembers to ask "commit and push" at the end. As soon as a table, a doc, a feature, or any other
  self-contained piece finishes, propose the commit message right then and wait for a yes — don't
  wait to be asked. Still one commit at a time, still confirmed (see below); the discipline is in
  the timing, not skipping the confirmation.
- **Keep commits granular:** one logical change per commit (e.g. "migrations for foundation tables",
  not "backend"). Scope each commit tightly.
- **Always confirm the commit with the user before running `git commit`** — present the message(s) and
  what each will include, and wait for a clear yes. Never auto-commit.
- **Never add AI attribution to commit messages** — no `Co-Authored-By: Claude …` trailer, no
  "Generated with" lines, nothing. Commit messages read as the author's own. Branch/PR only when asked.

## Workflow: Idea → Expansion → Review → Implementation

Every feature follows these four phases, in order:

1. **Idea** — a component/feature concept (a `roadmap.md` entry).
2. **Expansion** — expand it into `docs/srs/<phase>/<component>/{checklist,srs,use-cases}.md` + the
   `docs/data-model/DB-*.md` it touches. Surface missing/ambiguous use cases for confirmation.
3. **Review** — the user confirms; status → 🟢 Confirmed. **Nothing is implemented before this.**
4. **Implementation** — build strictly to the confirmed docs, with full tests (see `testing.md`);
   status → ✅ Implemented.

Proceed **one component at a time**: review → confirm (spec **and** data model, table-by-table) →
implement that component → next. Do not batch-confirm across components.

## Follow the documentation

- `docs/` is **authoritative**. Implement **only** what the confirmed docs specify.
- Read the relevant `srs.md` / `use-cases.md` (and `DB-*.md`) **before** writing code for a component.
- If code and docs diverge, **fix the docs first** (Review), then the code. Never let them drift.
- Any change to behaviour updates its use case / SRS in the same change.

## Docker-first development (remember this)

**All tooling runs in Docker — the host needs only Docker, never matching language runtimes.**
- **Node 24 + pnpm 11** run in a `node:24` container; **Go** in a `golang` container;
  Postgres/Kratos/Cerbos are compose services.
- Scaffolding, `pnpm install`, builds, migrations, and tests all execute **inside containers**, so the
  host's runtime versions (e.g. a Herd-managed Node 20) don't matter and never block work.
- The dev stack is one `docker compose` (the `docker/` unit); one `compose up` runs everything.
- Never assume host `node`/`pnpm`/`go`; invoke them through the containers.

## Don't write Laravel in Go

- No framework magic, no global mutable singletons (e.g. no global "current tenant" — it's a data
  race across goroutines; use `context.Context`).
- Explicit dependency passing; **no DI framework**. Wire dependencies in `main.go`.
- Organize by feature/module, not by `controllers/`/`models/`/`services/` layers.
- Errors wrapped with context; structured logging via `log/slog`.

## Inherited house conventions (from `../workspace` & `../erp`)

- **UUID v7** PKs (time-ordered); `timestamptz` for times, `date` for calendar facts.
- **Hierarchies:** adjacency `parent_id` + `path ltree` (GiST) with immutable `tree_key` labels.
- **Bilingual** operational text: paired `name` / `name_dv` (Thaana) columns — never a translations
  side-table.
- **Money:** `numeric(14,2)` + `currency char(3)` (MVR default, USD supported) + captured
  `exchange_rate`.
- **Soft deletes** (`deleted_at`) by default; lifecycle links use `active_from` / `active_to`.
- **Custom fields:** `custom_fields jsonb` + tenant-defined expression indexes — never per-tenant tables.
- **Authorization is Cerbos**, policy-driven — never embedded in the schema.
