# e2e

Playwright suite covering the operator-facing golden path end to end, against the **real running
dev stack** — not an ephemeral instance. Unlike the Go integration suite (which spins up its own
throwaway Postgres via Testcontainers per run), there's no equivalent self-contained way to spin up
Traefik + `*.bool.test` routing per test run, so this suite depends on `docker compose up` already
being up (matching `.claude/rules/testing.md`'s "Playwright against the running compose stack").

## Running

```bash
docker compose up -d
./run.sh
```

`run.sh` handles the one non-obvious part: a plain container isn't on the shared external `proxy`
network Traefik and the app/admin/api containers share, so `*.bool.test` doesn't resolve or route
from inside it by default. The script joins that network and maps each `*.bool.test` host this
suite uses to Traefik's current address on it (resolved fresh every run — it's a dynamic address,
never hardcoded).

Pass extra Playwright CLI flags straight through, e.g. `./run.sh --headed` or `./run.sh --debug`.

## What's covered, and what isn't yet

`tests/tenant-lifecycle.spec.ts` covers the full operator-facing lifecycle Phase H actually wired
to a real backend: sign in, provision a tenant, see it listed, suspend it, reactivate it, archive
it. It does **not** test "the suspended tenant's own login fails" — that would need `apps/app`'s
own backend integration and the tenant-resolution middleware
(`internal/tenancy.Middleware.RequireTenant`) mounted on a real route, neither of which exists yet
(`apps/app` is still mock-data only). Add that scenario once they do.

Runs against the persistent dev database, not a throwaway one — each run creates a new tenant with
a timestamp-based slug (`e2e-<timestamp>`) to avoid colliding with previous runs' data.
