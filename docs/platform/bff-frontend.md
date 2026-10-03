# App integration with the BFF

Status: implemented by `apps/workspace` and `apps/admin` (C90, C96–C100), through the
shared `@workspace/session` package (`packages/session`). `packages/auth`, the previous design (Kratos at `/auth` on the
app's domain), was removed (C100). Sign out is `signOut()` there (C101).

Each internal app is served by its backend-for-frontend (`bff-workspace` on tenant domains,
`bff-admin` on `admin.bool.test`), on the same domain as the app. The browser never
holds tokens and never talks to Kratos or Hydra directly.

| The app needs to | It does |
| --- | --- |
| Sign the person in | Navigate (not `fetch`) to `/auth/login?return_to=<local path>`; the BFF returns the browser to that path, signed in. |
| Know who is signed in | `GET /api/auth/me`: the user (`id`, `email`, `phone`, `displayName`) and the client. |
| Call the API | `fetch('/api/...')` on the same origin; the session cookie is sent automatically, and the BFF adds the access token. |
| React to being signed out | Any `/api` response `401` means no usable session: navigate to `/auth/login?return_to=<current path>`. |
| Sign out | Submit a form `POST /auth/logout` (a navigation, not `fetch`); the browser is signed out of the BFF, Hydra, and the login service, every other app of that login is signed out too, and it returns to the home page (C101). |
| Recovery, verification, account settings | Links to the login service at `identity.bool.test` (`/recovery`, `/verification`, `/settings`). |

Rules for the app:

- `/auth/*` and `/api/*` belong to the BFF and the API; the app must not use them for
  its own routes. Every other path without a file extension gets `index.html`.
- Do not read or set the session cookie (it is HttpOnly) and do not send an
  `Authorization` header; the BFF removes it.
- Requests that change data must be same-origin (`fetch` with relative URLs); the BFF
  refuses cross-origin writes.
- The page runs under a Content-Security-Policy (C99): scripts only from the app's own
  files, plus the inline scripts of `index.html`, which the BFF allows by hash at
  startup; no `eval`; styles and fonts from the app and Google Fonts (until Lato is
  self-hosted); images from the app and `data:`; API calls only to the same origin.

In development, Vite serves the app (hot reload) and Traefik sends `/auth` and `/api` to
the BFF. In a release, the BFF image embeds the app's `vite build` output
(`docker/bff.Dockerfile`).
