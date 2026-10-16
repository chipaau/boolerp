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
  website/                 the Bool ERP marketing site, Next.js (C87), at bool.test (C189)
  findcare/                FindCare's public side, Next.js (C189), at findcare.test
  education-portal/        a tenant's education portal, a Vite SPA (C192, C194), on the
                           tenant's own domain (C191)
packages/
  app-kit/                 defineApp and the manifest types (C102)
  app-control-centre/      an app: index.ts (manifest), rail.tsx, routes/, features/<feature>/
  org/                     the organisation record and people UI every app reads (C106)
  reference/               the reference lists (countries, legal forms, institution types, time
                           zones) and their pickers, for the admin console and every app (C201)
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
- General errors are handled in one place (C185): `createQueryClient({ notify })` applies one
  policy to every query and mutation. 401 sends the browser to sign-in and back; 403 and 404
  are the screen's state for a query, a toast for a mutation; 409 toasts and refetches; 422
  from a form shows on the fields and toasts "Check the highlighted fields and try again." (without a form, the
  problem's detail); 429, 5xx, network, and timeout are the screen's error state on a first
  load and a toast otherwise (with the request reference). A query or mutation opts out of a
  status with `meta: { handles: [...] }`. Queries retry network and 5xx errors twice, never a
  4xx; mutations never retry.
- Resources: `createKeys(name)` and per-feature `queryOptions` builders. A mutation lists the
  keys it changes in `meta.invalidates`: the query client refetches them on success, and on a
  404 or 409 (C185). A form's mutation also puts a 422's field errors on the form (C176).
- The admin console: `src/lib/query-client.ts` creates its QueryClient with `createQueryClient`
  and connects the policy to the app's toast (`ToastBridge`, rendered in the root route); the
  client reaches every route's loader through the router context (`RouterContext`).
- `packages/api/src`: `client.ts` (the fetch core), `error.ts` (`ApiError`), `policy.ts`
  (`decide`, the error policy as a pure function), `query-client.ts` (`createQueryClient`,
  `shouldRetry`, the `meta` types), `schemas.ts` (`listOf`, `listSearch`, `id`, `timestamp`),
  `keys.ts` (`createKeys`).
- Tests fake the network with MSW; the fetch core's own tests stub `fetch`.

### Pickers for long lists (C201)

- `@workspace/ui`'s `Combobox` is the searchable picker: type to narrow, arrows and Enter to
  choose. It is Base UI's Combobox with shadcn's base parts (`ComboboxInput`,
  `ComboboxContent`, `ComboboxItem`, `ComboboxChips`, …), drawn like `Select`.
  `ComboboxField` (one value) and `ComboboxMultiField` (several, as chips) take
  `{ value, label, keywords?, group?, detail? }` options. `Select` stays for a handful of fixed
  choices.
- The reference lists' pickers are `@workspace/reference`'s: `CountrySelect`,
  `LegalFormSelect` (a country's forms; it hands back the chosen form, whose
  `identityDocument` the form asks for), `InstitutionTypesField` (one or more types, one
  primary), and `TimezoneSelect`. Their queries live in the package's `api.ts`, the only file
  there that calls the API (C184), and are kept for the session (`staleTime: Infinity`).
- Time zones come from the browser (`Intl.supportedValuesOf('timeZone')`), not the API; the
  API still checks the chosen zone.
- An app that renders the package adds `@source "../../../packages/reference/src"` to its
  stylesheet, and Compose shadows the package's `node_modules` like the others.

### Types and forms (C176)

- Hand-written zod per feature: `tenantSchema` → `Tenant`, `createTenantSchema` →
  `CreateTenantInput` (the request body), `tenantListSearch` → `TenantListSearch`. A form has
  its own values schema only when its shape differs from the body, with a pure mapper to it.
- TanStack Form with zod (`onChange` once touched, `onSubmit`); field components in
  `@workspace/ui` take the form's `field`.
- Required fields are marked with an asterisk (*) after the label (C202): `Label`'s
  `required` (or a form's `Field` with `required`) draws it in the destructive colour with CSS,
  so it is not part of the label's text, and the control carries `required` (inputs) or
  `aria-required` (pickers). A field that is required only in some cases (an identity number
  when the legal form names a document) is marked while it is required. Optional fields carry
  no mark; a group that is wholly optional may say so in its heading.
- A 422's field errors appear on their fields (the `onServer` error), with the server's
  `detail` as the message; errors matching no field show in a banner above the form with the
  request reference; and a toast says "Check the highlighted fields and try again." (`INVALID_FORM_MESSAGE`,
  C185). Invalid values the form itself catches show on every field with the same toast, and
  are never sent. Editing a field clears its server error; submit is disabled only while
  sending.
- Toasts (C214): `useToast()` from `@workspace/ui/components/toast`, built on Base UI's Toast
  (the library the shadcn components use), which times them, pauses them on hover, stacks up to
  three, lets them be swiped away, and announces them in a live region (errors urgently). The
  design is a bottom-centre pill; an error's carries the request reference on a second line,
  stays 6.5 seconds, and can be dismissed. Tests find a toast's text with the selector
  `[data-slot="toast"] *`, since the live region holds a copy.
- Built (F3): `useApiMutation({ ...mutation, form })` in `@workspace/api` saves a form: on a 422
  it puts each `ApiError.fieldErrors` path on its field (`applyServerErrors`; `a.1.b` is the field
  `a[1].b`, falling back to the nearest field that exists) and returns `formErrors` for the
  rest. `@workspace/ui/components/form-field` has `FormField` (any control, given `id`, `value`,
  `onChange`, `onBlur`, `invalid`), `TextField`, and `FormErrorBanner`, bound to the `field`
  that `form.Field` gives (typed structurally, so `ui` needs no form dependency); a field shows
  its errors once touched, and its `onChange` clears the server's error. The first form is the
  admin console's create-tenant step 1 (`newTenantFormSchema` → `toCreateTenantInput`).

### The first list: tenants (C187)

`apps/admin/src/features/tenants/`: `schemas.ts`, `api.ts`, `columns.tsx`, `tenants-list.tsx`,
with `api.test.ts` and `tenants-list.test.tsx`; `routes/_admin/tenants/index.tsx` holds
`validateSearch`, `loaderDeps`, and the loader. The design prototype is at `/tenants-prototype`
until the list is accepted. Use it as the pattern for the next list.

### Responsive, mobile first (C219)

Every screen is built for a phone first: a high-end phone, 390–430 px wide (iPhone 15/16 and their
Plus and Pro Max, Galaxy S and Ultra), holding up to a 32-inch monitor (2560 px at its usual
scaling). Nothing overflows down to 360 px (the base Galaxy S), though a line may wrap there.

| Width | Device | Tailwind |
| --- | --- | --- |
| 390–639 px (no overflow from 360) | phone | unprefixed (the base layout) |
| 640 px | large phone, small tablet | `sm` |
| 768 px | tablet | `md` |
| 1024 px, 1280 px | laptop | `lg`, `xl` |
| 1536 px and up, to 2560 px | desktop, 27–32-inch monitors | `2xl` |

- **Mobile first:** the unprefixed classes are the phone's layout, and each breakpoint adds to it
  (`px-4 sm:px-8`, `hidden md:table-cell`). A desktop layout patched down with `max-*` variants is
  not mobile first.
- **No horizontal page scroll** at any width. A table hides its secondary columns below `md` and
  folds their essentials into the first column (`meta.wide`), or scrolls inside its own card.
  Toolbars and footers wrap rather than overflow. A list's footer count names no noun ("Showing
  [25 ▾] of 249": the page above names what is listed), and on a phone it is one line: "[25 ▾] of
  249" and the pager "‹ 3 / 10 ›".
- **Gutters:** 16 px a side on a phone, 32 px from `sm`; a table's edge padding is 16 px on a phone
  and 22 px from `sm`.
- **Touch:** targets are at least 24 × 24 px (WCAG 2.2, 2.5.8) with space between them; nothing
  depends on hover alone.
- **Wide screens:** content does not stretch to fill a 32-inch monitor. Running text stays within
  about 75 characters a line; forms and dialogs keep their own widths; a page's content stops at
  1920 px (`max-w-[120rem]`) and is centred beyond it, with data tables free to use that width.
- **Checking:** a change is looked at in the browser at 390, 768, 1024, 1440, and 2560 px;
  component tests do not replace it.

### Tabs on a landing page (C218)

- A landing page with tabs gives each tab its own path, `/<section>/<tab>`
  (`/geographies/geographies`, `/geographies/countries`, `/geographies/geography-types`), so a tab
  can be linked to and survives a reload. Each tab is its own file route with its own
  `validateSearch` and loader, so its list's state (C174) is only its own and never reaches
  another tab's API call.
- `/<section>` redirects to the first tab; an older `?tab=` link redirects to its tab. Never a
  `?tab=` parameter.
- Each tab's page renders the section's shared header (title, its own count, the tab bar); the tab
  bar navigates between the paths.

### List pages (C174)

- The URL holds the list's state with the API's parameter names: `page`, `pageSize`, `q`,
  `sort` (`-` for descending), one key per filter. The route validates it with a zod schema
  in `validateSearch`; invalid values fall back to defaults. Changing search, a filter, or the
  sort resets `page` to 1 and replaces the history entry.
- The page size a viewer chooses is remembered in their browser (C222): `DataTable` saves it
  (`rememberPageSize` in `@workspace/ui/lib/page-size`), and `listSearch` opens every list at it
  when the URL names none; the URL still wins. Lost in a private window or with storage cleared,
  when lists fall back to 25.
- The route's loader prefetches the feature's `queryOptions`; the page uses the same options
  with `keepPreviousData`.
- `@workspace/ui`'s `DataTable` (TanStack Table v8, manual mode) renders typed columns (a
  sortable column's `id` is the API's sort field), a toolbar with a 300 ms debounced search
  and filters declared as data, pagination, and the standard loading, empty, no-match,
  forbidden, error, and refetching states.
- `DataTable` (`@workspace/ui/components/data-table`): columns are TanStack Table definitions;
  a sortable one sets `enableSorting`, an `id` that is the API's sort field, and an accessor
  (TanStack Table sorts only columns with one, even in manual mode); `meta.wide` hides a column
  below `lg`. It shows the first load's error (403 as forbidden, others with the reference and a
  retry); when data is shown, a failed refresh keeps it (the error policy toasts, C185).
  `ListToolbar` (`list-toolbar`): `search` (debounced), `filters` (declared as data: `select` chips, or a searchable `combobox` for a long list such as the countries, C220),
  `summary`, `onClear`.
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
