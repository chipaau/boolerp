# Frontend structure

Status: the workspace's structure is decided (ADR 0004, C102–C106); Control Centre is the
first app moved into its own package. The other workspace apps are still prototypes in the
shell and move one at a time.

## Layout

```text
apps/
  workspace/               the workspace shell on tenant domains (bff-workspace)
    editions/<name>.ts     app packages each edition ships (EDITION=<name>, default full, C107)
    vite.config.ts         route tree: shell routes + the edition's app routes; virtual:edition
    src/lib/apps.ts        the apps on the home grid and switcher (edition manifests + prototypes)
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
packages/app-control-centre/e2e/   the app's end-to-end journeys (run by e2e/, C109)
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
- The top bar is the workspace's (suite) menu: brand, search, theme, workspace, app switcher,
  notifications, account. It is the same for every app and stays in place when switching apps;
  a manifest cannot change it. The shell knows the current app from the URL (`useCurrentApp`).
- The shell draws each app's sidebar (or the app's rail) around its pages.

## Editions (C107)

An edition is `apps/workspace/editions/<name>.ts`, a list of app package slugs; `full` lists every
app package. `EDITION=<name>` chooses one at build or dev time (default `full`):

```sh
EDITION=full pnpm --filter workspace build
docker build -f docker/bff.Dockerfile --build-arg APP=workspace --build-arg EDITION=full .
```

The router config mounts the edition's app routes, and the shell reads the edition's manifests
from `virtual:edition`; apps outside the edition are not in the bundle. Product editions (which
apps each sells) are decided with licensing (D10).

## Adding an app

1. Create `packages/app-<slug>` with its manifest, routes, and features.
2. Add `@workspace/app-<slug>` to `apps/workspace/package.json` and `<slug>` to `editions/full.ts`
   (and any other edition that ships it).
3. `pnpm --filter workspace test` checks every edition lists existing, declared app packages, the
   full edition lists every app package, and every page declares a permission.

## Data

TanStack Query with query-key factories, loaders prefetching through the router's context,
TanStack Form with zod, and URL state through `validateSearch` (C103). `@workspace/api` (fetch
core, errors, resources, mutation helper) arrives with the first real API resource; the apps
read mock data until then.
