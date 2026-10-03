# ADR 0004: Workspace apps as packages

Date: 2026-10-02.
Status: accepted (C102–C106).

## Context

The tenant workspace (`apps/app`, renamed `apps/workspace` by C108) hosts several apps: Control Centre, Task Management,
HRMS, Inventory, Calendar, Directory, and more. They are products in their own right, with
their own pages, navigation, and permissions, and a customer may have some and not others,
as the backend's editions allow (C93). The prototype served every app from one dynamic route
(`/$app/$section`) and a central registry; shared organisation data lived in shell folders that
every app imported. The reviewed `sentinel-app` shows the cost of that shape at scale: one
feature split across route, service, and schema trees; modules importing each other's
internals; registration spread over many files and failing open.

## Decision

- **An app is a workspace package** (`packages/app-<slug>`). It exports a manifest
  (`defineApp` from `@workspace/app-kit`: slug, name, icon, menu with a permission per page,
  optional rail) and keeps its pages as file routes in `src/routes`. Apps never import each
  other.
- **The workspace shell** (`apps/app`) owns the chrome (header, app grid, sidebar, sign-in) and
  lists the app packages of its edition once (`editions/<name>.ts`, C107). The router config mounts each
  app's routes at `/<slug>` with TanStack Router's virtual file routes (`physical()`), producing
  one type-checked route tree; the shell draws each app's sidebar from its manifest.
- **Inside an app:** `src/features/<feature>/` (data, components, an `index.ts` as the only
  import for other features) and thin route files (search-param validation, loader prefetch,
  the page).
- **Shared data and pieces are platform packages**, never another app: `@workspace/org` (the
  organisation record every app reads, raising notifications, shared people UI),
  `@workspace/session` (sign-in through the BFF), `@workspace/ui` (design system, generic
  helpers), and, with the first real API resource, `@workspace/api` (C103).

## Consequences

- An edition with fewer apps lists fewer packages; their code is not in its bundle. Editions
  are files chosen at build time (`EDITION`, C107).
- Adding an app is one package and one line in the edition; the menu and route guards read
  the manifest, so a page without a permission is refused.
- Cross-app reads go through platform packages or the API, not app code; where the prototype
  read another app's data, the read goes through that app's query key until an API exists.
- More packages and lockfile entries to manage; Tailwind must scan each package the edition
  ships.
- Prototype apps move one at a time; until then the shell's dynamic route keeps serving them.
