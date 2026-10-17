# Frontend scope

Frontend integration has started: the apps sign in through their BFFs, are built from
workspace packages and editions, and have end-to-end tests. Its standards are not set
yet: the business API contract and client generation, the data layer (loaders, forms,
validation), and the scope of browser tests (C128). Propose them and ask; do not set
them by default. See [product scope](../../docs/product/scope.md) and
[development](../../docs/development.md).

- Do not inspect or modify frontend application code as a prerequisite for backend design.
- Backend design does not wait on the frontend; integration work happens when requested.
- Do not generate clients, change routes, or embed frontend assets until that work is requested.
- Documentation and instruction-file relocation is allowed when documentation organization
  is explicitly requested; it does not authorize application changes.
- Preserve the newer frontend source and shared packages from `develop`; do not copy
  frontend code from the older `go-erp` checkout. The frontend is other team
  members' work: do not modify or delete it, including `e2e/`, unless the user asks for
  a specific change (as for removing `packages/auth`, C100).
- `apps/workspace` and `apps/admin` sign in only through their BFF, following
  [app integration](../../docs/platform/bff-frontend.md): no Kratos or Hydra calls and no
  tokens in the browser. `packages/auth` (the previous design) was removed (C100).
- Forms (C176): TanStack Form with the feature's zod schema as its validator; save through
  `useApiMutation({ ...mutation, form })` from `@workspace/api` so the API's 422 lands on the
  fields (never by feeding server errors into zod), with `FormErrorBanner` for the rest; fields
  from `@workspace/ui/components/form-field` (`FormField`, `TextField`) bound to `form.Field`'s `field`.
- Build every screen mobile first and responsive from a high-end phone (390–430 px: iPhone,
  Galaxy S and Ultra) to a 32-inch monitor (C219), with nothing overflowing down to 360 px: the
  unprefixed classes are the phone layout, and `sm` (640), `md` (768, tablet), `lg`
  (1024, laptop), `xl` (1280), and `2xl` (1536, desktop) add to it; never a desktop layout patched
  down with `max-*` variants. No horizontal page scroll at any width: a table hides its secondary
  columns below `md` (folded into the first column) or scrolls inside its card. Page gutters are
  16 px on a phone and 32 px from `sm`. Touch targets are at least 24 px (WCAG 2.2) and spaced.
  On wide screens content does not stretch: text stays within about 75 characters a line, forms
  and dialogs keep their widths, and a page's content stops at 1920 px (`max-w-[120rem]`,
  centred). A list's footer count names no noun ("Showing [25 ▾] of 249"; the page names what is
  listed), and on a phone it is one line: "[25 ▾] of 249" and the pager "‹ 3 / 10 ›".
  Check a change in the browser at 390, 768, 1024, 1440, and 2560 px.
- A list's page size comes from the URL, or else the size the viewer last chose anywhere in the app,
  remembered in the browser (C222); use `listSearch` and `DataTable`, which do both, never a
  list's own storage.
- Tabs on a landing page are paths (C218): each tab is its own route at `/<section>/<tab>`
  (`/geographies/countries`), with its own `validateSearch`, loader, and list state; `/<section>`
  redirects to its first tab. Never a `?tab=` parameter. The tab bar navigates between the paths.
- Integrating a screen that has a prototype (C226): build it as the prototype draws it — its layout,
  order, headings, labels, placeholders, notes, badges, and behaviour — unless the user explicitly
  says otherwise. Change only what a confirmed decision makes absent or impossible (a feature not built,
  a rule such as C202's asterisks, data that comes per country), keep the rest verbatim, and list
  every difference in the pull request. Never rename, retitle, reword, add sections, or show data the
  prototype does not, on your own judgement; ask first. The prototype is the page without the API
  (`/tenants-prototype`, the same component without `onCreated`). Text a decision makes untrue
  stays as the prototype has it unless the user says otherwise ("Apps & modules" stays). Once every
  part of a prototype is integrated, ask the user whether to remove the prototype; never remove it
  without that answer.
- Mark every required form field with an asterisk (*) after its label: `Label`/`Field`
  `required`, and `required` or `aria-required` on the control (C202). Optional fields have no mark.
- Read [frontend structure](../../docs/architecture/frontend.md). Workspace apps (Control
  Centre, HRMS, Tasks, Inventory, …) are packages `packages/app-<slug>` with a `defineApp`
  manifest (a permission per page) and file routes mounted by the shell's edition (C102);
  apps never import each other or the shell; shared data is a platform package such as
  `@workspace/org` (C106). Inside an app: `features/<feature>/` and thin routes.
- Internal applications (`apps/workspace`, `apps/admin`) use React with Vite and TanStack
  Router; each is embedded in and served by its backend-for-frontend service
  (`bff-workspace`, `bff-admin`, C90, ADR 0003). Public-facing applications,
  reached by people outside a customer's staff (`apps/website`, `apps/identity`, and
  `apps/findcare` — FindCare's public side, C189), use Next.js (C87). A tenant portal is the
  exception: it is an authenticated app whose login lives on the identity service (C84) and whose
  public pages need no indexing, so it is a Vite SPA served by its own BFF instance, the workspace
  pattern (C192). A tenant host reaches the right one through the BFF's resolver role (C193). All apps share `@workspace/ui` and
  `@workspace/assets`; other changes to these conventions need explicit agreement. `apps/findcare` is the
  one exception, and only to the design: it uses the shared components but defines its own tokens in its
  own `globals.css`, overriding the Bool values it imports (C190). FindCare's design never goes into
  `packages/ui`, which stays Bool's for the workspace, admin and website.
