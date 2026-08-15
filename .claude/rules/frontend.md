# Frontend

- **React + TanStack Router (Vite SPA) + official shadcn/ui.** React + shadcn decided 2026-08-13
  (SolidJS rejected — shadcn's official CLI/registry/monorepo tooling is React-only). **TanStack
  Router chosen over TanStack Start 2026-08-14:** Start's only added value is a Nitro server runtime
  we don't use, so a pure Vite SPA is the cleaner fit for static-embed-in-Go. Do not revert to Solid or Start.
- **Pure client SPA — no SSR, no server runtime.** File-based **type-safe routing** via
  `@tanstack/react-router`; `vite build` → static assets embedded in the Go binary / served from a CDN.
  There is **no Node runtime in the frontend**; all data via `@tanstack/react-query` against the
  OpenAPI-generated Go client. (This structurally enforces the old "no server functions" guardrail.)
- **Components: official shadcn/ui** via its CLI (`pnpm dlx shadcn@latest init` / `add`). In the
  monorepo, base components live in `packages/ui` and apps import them via `@workspace/ui/*`
  (see `monorepo.md`). Reuse the component patterns already in `../workspace/app` (React 19 + shadcn).
- **Serving:** `vite build` → static → **`go:embed`** in the Go binary on-prem (one artifact) /
  **CDN** for SaaS. SPA fallback to `index.html`; hashed assets `immutable`, `index.html` `no-cache`.
- **Bundle is tenant-agnostic**; discovers tenant from `window.location.hostname`. One
  `GET /api/v1/bootstrap` gated in the TanStack root loader behind a branded splash; handle 401
  (→ login, preserve deep link) and 403 (→ no-access + tenant switcher).
- **Go↔TS types:** OpenAPI contract from the Go API → generated typed TS client
  (openapi-typescript/orval) in `packages/api-client` → TanStack Query.
- **`apps/app` is modular** — one shell hosting modules that mirror the backend (Control Centre +
  the business modules Inventory / HRMS / Procurement / Performance). **Control Centre** is the
  *tenant's own admin* module: the tenant manages **their** users, roles/permissions, org units,
  sites, and settings there. Tenant admin lives here — **distinct from `apps/admin`** (the
  platform/operator console). In Phase 1, `apps/app` is essentially Control Centre + login.
- **Operator console = `apps/admin`** — a separate TanStack Router (React, Vite SPA) + shadcn app, **single origin**
  `admin.bool.mv` (not tenant-subdomain; the operator selects which tenant to act on), **internal-only**
  (enforced MFA + IP/VPN). Shares `packages/ui` + `packages/api-client`; calls a gated `/api/v1/admin/*`
  route group on the same Go API. Hosts provisioning, suspension, and support/impersonation. Embedded in
  the Go binary like `app`.
- **Next.js is used only for the separate marketing website** (`apps/website`), never the app. It
  shares `packages/ui` (shadcn) with the app and deploys separately (public/SEO), not embedded in Go.
