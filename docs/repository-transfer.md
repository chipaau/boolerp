# Repository correction and preserved work

Updated: 2026-09-26.

## Active repository

The user confirmed that `/Users/chipaau/code/bool/erp` is the intended checkout.
Its fetch/push remote remains `git@github.com:boolmv/erp.git`.
The sibling `go-erp` checkout uses GitLab and is not the active rebuild workspace.

After fetching `origin/develop`, local `develop` was fast-forwarded to
`70eb43a`. The new `api-rebuild` branch starts at that commit. No
`fix/security-review` commits have been merged into this branch.

Only the agreed API scaffold, architecture decisions, documentation organization,
and four-service Compose baseline were transferred. Existing frontend source,
shared packages, and frontend tool versions come from this repository's
`develop`, not from `go-erp`. The Go module remains `github.com/boolmv/erp`
and retains this repository's Go 1.27 baseline.

## Preserved work

- The original `fix/security-review` branch remains at `bf72c16`.
- All 12 modified/untracked files from that working tree are saved byte-for-byte
  in stash `6365a7f7eb423027a3afe0a727c9dfdcf782fdab`, named
  `pre-api-rebuild: preserve fix/security-review work`.
- That stash includes the untracked rate-limiter implementation and its tests.
  It has not been applied to the fresh API or dropped.
- `apps/api.bak/` preserves the original API from `develop`, not the
  security-review branch or its stash.
- Earlier docs are under `docs/archive/pre-api-rebuild/`; earlier agent rules
  are under `.claude/archive/pre-api-rebuild/`.
- Existing `.env` and database volumes are not reset or replaced.

To recover the security work later, first save any rebuild changes and use a clean
checkout of `fix/security-review`. Then apply (not pop) the recorded stash:

```sh
git stash apply 6365a7f7eb423027a3afe0a727c9dfdcf782fdab
```

Do not apply it over the new API. The rebuild has not been committed or pushed by
this transfer. The work in `go-erp` is left intact; no cross-repository history
rewrite or remote change was performed.

## Verification on 2026-09-26

- All 86 archived API files and 48 relocated docs/rule files match their originals.
- All 327 tracked frontend/shared non-documentation files and the existing `.env`
  are unchanged from the selected baseline.
- Go 1.27.1 container checks passed: formatting, vet, package compilation, API
  build, HTTP liveness, clean SIGTERM shutdown, and failure on an invalid port.
  The scaffold has no application test cases yet.
- The standalone API Dockerfile builds successfully without legacy dependencies.
- Compose validates with exactly `api`, `app`, `postgres`, and `redis`; CI YAML
  parses, and links in current documentation resolve.
- The sibling `go-erp` API container was stopped; `erp-api-1` is running and
  healthy. `http://cyryx.bool.test/api/healthz` returned `200` and
  `{"status":"ok"}` through the shared proxy.

During the initial transfer, only the new API was started, with `--no-deps`.
A subsequent Docker cleanup removed the project's previous containers, including
orphan services, and recreated `api`, `postgres`, and `redis`. All three are
healthy, and the proxied health endpoint returns `200` with `{"status":"ok"}`.
Volumes and the shared proxy were preserved; no database migration, frontend
startup, or data reset was performed.

## Frontend and automation boundary

The retained frontend has Kratos login/session flows and some real operator API
calls, but its employee data is still fixture-backed. Removing legacy providers
from Compose intentionally disconnects those flows during the rebuild. Their
presence does not approve providers or routes for the new API.

CI now checks the new Go scaffold in Docker, while retaining frontend build jobs.
The legacy browser E2E job is explicitly disabled until frontend integration
restores its required endpoints and services. The E2E source remains unchanged.
The static API container recipe builds the scaffold without a `go.sum`; it is
not a completed product release.

Only one checkout should serve `*.bool.test/api/*` at a time. Stop the old
`go-erp` API container before starting this checkout's API to avoid competing
Traefik routes. Use explicit working directories when invoking Compose.

See [development](development.md) for commands and [roadmap](roadmap.md) for the
next layer.
