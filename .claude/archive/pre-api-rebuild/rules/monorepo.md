# Monorepo

**Single repo, polyglot (Go + TS), pnpm workspaces + Turborepo** — matches `../erp` house style
and shadcn/ui's official monorepo tooling.

## Layout

```
erp/
├── apps/
│   ├── app/                 # TanStack Router (React, Vite SPA) — the ERP app (behind login), per-tenant subdomain; embedded. Modular: Control Centre (tenant admin) + business modules
│   #                          Control Centre = the tenant's OWN admin (their users/roles/org-units/sites/settings) — distinct from apps/admin (operator console)
│   ├── admin/               # TanStack Router (React, Vite SPA) — operator/platform console (internal), single origin admin.bool.mv; embedded, internal-only
│   ├── website/             # Next.js — public marketing + onboarding/signup (SEO); deployed SEPARATELY, not embedded
│   └── api/                 # Go module (own go.mod): cmd/api, internal/{foundation,apps,shared}
├── packages/
│   ├── ui/                  # shared shadcn components — used by app, admin, and website; `shadcn add` installs here
│   └── api-client/          # OpenAPI-generated TS client (app + admin; website uses it for onboarding)
├── docker/                  # compose unit: postgres, kratos(+migrate), cerbos, api
├── turbo.json
├── pnpm-workspace.yaml
└── CLAUDE.md
```

> Naming: `app` (not `web`) for the ERP application, so it never reads ambiguously against
> `website`. `web` was only the shadcn/Turborepo template default.

## Deploy targets differ per app

- `apps/app` (ERP app) → static build → **embedded in the Go binary** (self-host) / CDN. Behind login, per-tenant subdomain.
- `apps/admin` (operator/platform console) → static build → **embedded in the Go binary**, served at `admin.bool.mv`,
  **internal-only** (IP allowlist/VPN + internal-tenant membership + enforced MFA). **Single origin** (operator selects
  the tenant to act on) — NOT tenant-per-subdomain. Hosts provisioning, suspension, support/impersonation. Hits a gated
  `/api/v1/admin/*` route group on the **same** Go API.
- `apps/website` (marketing) → **its own deployable** (Next runtime for SSR/ISR SEO, or static export),
  public internet. **Not** embedded in Go. Uses `packages/api-client` for the public onboarding/signup flow.
- `apps/api` (Go) → the backend serving both.

## shadcn/ui (official monorepo mode)

- Each JS workspace has its own `components.json`. `apps/app`, `apps/admin`, and `apps/website` alias
  `ui` → `@workspace/ui/*`; `packages/ui` holds the components. `shadcn add <x>` **auto-routes** base
  components into `packages/ui` and fixes imports.
- Keep `style`, `iconLibrary`, and `baseColor` **identical** across all `components.json` files
  (shadcn requires this).

## The polyglot glue (the one real friction point)

- **`go:embed` needs the app build inside the Go module tree.** `apps/app`'s build output is copied
  into `apps/api` (e.g. `apps/api/internal/web/dist`) before `go build`, so the binary embeds it →
  one self-host artifact. (`apps/website` is not embedded — it deploys on its own.)
- **Turbo task graph:** `api-client` codegen (from the API's OpenAPI spec) → `app` build →
  copy `dist` into `apps/api/internal/web/dist` → `go build`. Turbo orchestrates the JS tasks; Go
  uses its own toolchain/cache (turbo can invoke it but won't cache it).

## Best-practice setup order

1. Root: `pnpm-workspace.yaml` (`apps/*`, `packages/*`) + `turbo.json`.
2. `apps/app`: scaffold **TanStack Router (React)** as a Vite SPA.
3. `shadcn init` in monorepo mode (`ui` → `packages/ui`); `shadcn add` for base components.
4. `apps/api`: Go module (`go.mod`), Chi skeleton.
5. `packages/api-client`: generate from the API's OpenAPI spec; wire into TanStack Query.
6. Wire the `dist` → `apps/api/internal/web/dist` copy + `go:embed`.
7. `apps/website`: Next.js marketing app (later; shares `packages/ui`).

> Scaffolding is a change — only execute with explicit confirmation (see `conventions.md`).
