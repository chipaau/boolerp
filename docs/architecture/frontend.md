# Frontend structure

Status: the workspace's structure is decided (ADR 0004, C102–C106); Control Centre is the
first app moved into its own package. The other workspace apps are still prototypes in the
shell and move one at a time.

## Layout

```text
apps/
  app/                     the workspace shell on tenant domains (bff-app)
    edition.ts             app packages this edition ships → routes mounted at /<slug>
    vite.config.ts         route tree: shell routes + each app's src/routes (virtual file routes)
    src/lib/apps.ts        the apps on the home grid and switcher (manifests + prototypes)
    src/routes/            shell routes: sign-in, home, notifications, the prototype $app routes
    src/features/          the shell's own features and the remaining prototype apps
  admin/                   the operator console (bff-admin); one app, same conventions (C104)
  identity/                the login service, Next.js (C105)
packages/
  app-kit/                 defineApp and the manifest types (C102)
  app-control-centre/      an app: index.ts (manifest), rail.tsx, routes/, features/<feature>/
  org/                     the organisation record and people UI every app reads (C106)
  session/                 sign-in, the signed-in user, sign-out through the BFF
  ui/                      the design system and generic helpers (dates, CSV, brand, page titles)
  assets/                  brand artwork
```

## An app package

```text
packages/app-control-centre/src/
  index.ts                 defineApp({ slug, name, icon, rail, menu: [{ items: [{ title, slug, permission }] }] })
  rail.tsx                 optional custom sidebar rail
  routes/                  thin file routes: validateSearch, loader prefetch, the page
    index.tsx  units.tsx  employees.tsx  …
  features/<feature>/      data and components; index.ts is what other features import
    shared/  overview/  organisation/  sites/  system/  billing/
```

Rules:

- Apps never import each other or the shell. What several apps need is a platform package
  (`@workspace/org`, `@workspace/ui`, `@workspace/session`); where the prototype read
  another app's data, it reads that app's query key until the API provides it.
- Every menu entry in a manifest names the permission its page needs (`app:resource:action`).
  The menu and, once authorization exists (step 8), the route guards read the same
  declaration; the API checks again.
- Route files stay thin; a route's search params are validated in the route, and pages read
  them from their own route.
- The shell draws each app's sidebar (or the app's rail) around its pages.

## Adding an app to an edition

1. Create `packages/app-<slug>` with its manifest, routes, and features.
2. Add `<slug>` to `apps/app/edition.ts`, the manifest to `src/lib/apps.ts`, the package to
   `apps/app/package.json`, and its `src` to Tailwind's `@source` in `src/styles.css`.
3. `pnpm --filter app test` checks the edition and manifests agree and every page declares a
   permission.

## Data

TanStack Query with query-key factories, loaders prefetching through the router's context,
TanStack Form with zod, and URL state through `validateSearch` (C103). `@workspace/api` (fetch
core, errors, resources, mutation helper) arrives with the first real API resource; the apps
read mock data until then.
