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
TanStack Form with zod, and URL state through `validateSearch` (C103). The standards are
being decided one area at a time on the admin console's tenants (roadmap F1, C128).

### API access and the fetch core (C175, C184)

- API calls live in one place, at two levels: only `@workspace/api` calls `fetch`, and each
  feature's calls (keys, `queryOptions`, mutations) live in its `features/<x>/api.ts`;
  components and routes import from there, never `@workspace/api`'s `api` directly (C184).

- The browser calls only same-origin `/api/...`; the app's BFF adds the token and forwards
  to the API. No base URLs, tokens, or direct API calls in frontend code.
- `@workspace/api` is the one fetch core: `api.get/post/put/patch/delete(path, { query,
  body, signal, schema })`, responses parsed with zod (`listOf(item)` for lists), the query's
  `signal` passed through, a 30-second timeout. Lint bans raw `fetch(` elsewhere (except
  `@workspace/session`).
- Every failure is an `ApiError` with a `kind` (`http`, `network`, `timeout`, `aborted`,
  `contract`), built from the RFC 9457 problem: `status`, `type`, `title`, `detail`,
  `requestId`, `fieldErrors` (from JSON pointers, as dotted paths), `paramErrors`.
- 401 sends the browser to sign-in and back; 403 is a forbidden state or a permission toast;
  queries retry network and 5xx errors twice, never a 4xx; mutations never retry.
- Resources: `createKeys(name)`, per-feature `queryOptions` builders, and `useApiMutation`
  (invalidation, toasts, 422 onto the form).
- Tests fake the network with MSW; the fetch core's own tests stub `fetch`.

### Types and forms (C176)

- Hand-written zod per feature: `tenantSchema` → `Tenant`, `createTenantSchema` →
  `CreateTenantInput` (the request body), `tenantListSearch` → `TenantListSearch`. A form has
  its own values schema only when its shape differs from the body, with a pure mapper to it.
- TanStack Form with zod (`onChange` once touched, `onSubmit`); field components in
  `@workspace/ui` take the form's `field`.
- A 422's field errors appear on their fields (the `onServer` error), with the server's
  `detail` as the message; errors matching no field show in a banner above the form with the
  request reference. Editing a field clears its server error; submit is disabled only while
  sending.

### List pages (C174)

- The URL holds the list's state with the API's parameter names: `page`, `pageSize`, `q`,
  `sort` (`-` for descending), one key per filter. The route validates it with a zod schema
  in `validateSearch`; invalid values fall back to defaults. Changing search, a filter, or the
  sort resets `page` to 1 and replaces the history entry.
- The route's loader prefetches the feature's `queryOptions`; the page uses the same options
  with `keepPreviousData`.
- `@workspace/ui`'s `DataTable` (TanStack Table v8, manual mode) renders typed columns (a
  sortable column's `id` is the API's sort field), a toolbar with a 300 ms debounced search
  and filters declared as data, pagination, and the standard loading, empty, no-match,
  forbidden, error, and refetching states.
- Responses are parsed with zod in every environment; a mismatch is an error naming the field.
- Types are hand-written zod per feature (`features/<x>/schemas.ts`), camelCase; there is no
  OpenAPI and no generated client (C183).

```text
features/<feature>/
  schemas.ts    response and search schemas; types via z.infer
  api.ts        keys, queryOptions builders, mutations
  columns.tsx   the table's columns
  <feature>-list.tsx   the page
routes/<feature>/index.tsx   validateSearch, loaderDeps, loader only
``` `@workspace/api` (fetch
core, errors, resources, mutation helper; C175) arrives with the tenants list (F2); the apps
read mock data until then.
