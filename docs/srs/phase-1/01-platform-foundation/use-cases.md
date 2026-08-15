# 01 — Platform Foundation — Use Cases

**Status:** 🟡 In Review. Actors: **Installer/Operator**, **App** (`apps/app`/`apps/admin`), **Chi**
(the binary), **Ops** (orchestrator/compose), **CI**.

---

## UC-FND-01 — Cold start / boot sequence *(system)*
- **Trigger:** the binary starts. · **Main flow:**
  1. Load config (env-first).
  2. Connect the pgx pool as the **non-owner** runtime role.
  3. Verify migrations are applied (fail fast if not).
  4. Run idempotent reference-data seeders (currencies, countries, atolls/islands/wards).
  5. Run the **RLS coverage guard** (UC-FND-06); refuse to serve if it fails.
  6. Start HTTP: `/api/*`, embedded SPAs, `/healthz`, `/readyz`.
- **Exceptions:** DB unreachable → not ready; migrations pending → fail fast with guidance.
- **Postcondition:** binary serving, or refusing to start with a clear reason.

## UC-FND-02 — First-run interactive setup *(Installer/Operator)*
- **Trigger:** first visit to a fresh install where **no internal tenant exists**.
- **Preconditions:** `compose` up (Postgres, Kratos, Cerbos); DB migrated.
- **Main flow:**
  1. Chi detects "uninitialized" → serves the **setup wizard** (setup route only).
  2. Installer enters org + first-operator details.
  3. Chi creates the **internal/operator tenant** + the first operator identity (Kratos admin API) + owner membership + operator role.
  4. Chi emits an activation link (operator sets credential — see UC-AUTH-01) and **locks the setup route**.
  5. Operator signs in to `apps/admin`.
- **Exceptions:** setup attempted after initialization → 404/locked; partial failure → transactional rollback, retry.
- **Postcondition:** the box has an internal tenant + a working operator; setup is closed.

## UC-FND-03 — Tenant-scoped request lifecycle *(system)*
- **Trigger:** any `/api/v1/*` request on a tenant subdomain. · **Main flow:**
  1. Authenticate (`whoami`, UC-AUTH-08).
  2. Resolve tenant from the forwarded Host; verify active membership (404 if not).
  3. `WithTenant` opens a tx, sets `app.current_tenant` (+ `app.visible_tenants`) LOCAL.
  4. Cerbos authorizes the action.
  5. Handler runs queries — **RLS auto-scopes**; queries never mention `tenant_id`.
- **Exceptions:** 401 (no session) · 404 (not a member) · 403 (tenant suspended / Cerbos deny).
- **Postcondition:** response produced under an isolated tenant context.

## UC-FND-04 — Bootstrap fetch *(App)*
- **Trigger:** SPA root loader calls `GET /api/v1/bootstrap`. · **Main flow:** Chi returns
  user + active tenant + memberships + capabilities + enabled modules.
- **Exceptions:** 401 → login (preserve deep link); 403 → no-access + tenant switcher.
- **Postcondition:** SPA can render the tenant shell.

## UC-FND-05 — Health & readiness *(Ops)*
- **Trigger:** orchestrator probes. · **Main flow:** `/healthz` = process alive; `/readyz` = DB +
  Kratos + Cerbos reachable. · **Postcondition:** traffic routed only when ready.

## UC-FND-06 — RLS coverage guard *(CI + startup)*
- **Trigger:** CI run and every boot. · **Main flow:** enumerate tenant-scoped tables; assert each has
  `FORCE ROW LEVEL SECURITY` + a policy + the `tenant_id` default. · **Exceptions:** any gap → CI fails /
  boot refuses. · **Postcondition:** no tenant table can ship without isolation.

## UC-FND-07 — Parent aggregation mode *(system)*
- **Trigger:** a parent requests roll-ups across authorized descendants. · **Main flow:**
  1. App resolves the authorized descendant set (ltree subtree ∩ `tenant_visibility_grants`, per scope/module).
  2. `WithTenant` sets `app.visible_tenants` = `[current + descendants]` (writes stay single-tenant via `WITH CHECK`).
  3. Read queries span the visible set; results are aggregate/detail per grant scope.
- **Exceptions:** no grant → only own tenant visible; expired grant → excluded.
- **Postcondition:** parent sees exactly its authorized visible set — DB-enforced, no scope-bypass.

## UC-FND-08 — Bring up the self-hostable unit *(Installer/Ops)*
- **Trigger:** `docker compose up` on a fresh box. · **Main flow:**
  1. Postgres starts (creates app + kratos DBs); Kratos migrate runs, then Kratos serves.
  2. Cerbos loads policies; the `api` container migrates the app schema and serves (embedding both SPAs).
  3. `/readyz` goes green when DB + Kratos + Cerbos are reachable; first-run setup (UC-FND-02) becomes available.
- **Exceptions:** a dependency unhealthy → `api` stays not-ready with a clear log; migration failure → `api` refuses to serve.
- **Postcondition:** the full stack (postgres · kratos(+migrate) · cerbos · api+SPAs) is up from one command.
- **Notes:** Kratos admin API + Cerbos are **internal-only** (never published); dev + prod compose overlays.

---

## ⚠️ Open items
- Exact `/bootstrap` payload (confirm vs `frontend.md`).
- Reference datasets (atolls/islands/wards) source/version.
- Whether first-run configures Kratos/Cerbos or only app state.
