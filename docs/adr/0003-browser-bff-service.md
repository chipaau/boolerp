# ADR 0003: A separate backend-for-frontend service for browsers

Date: 2026-10-01.
Status: accepted (C88 revised, C90).

## Context

Browsers must never hold Hydra tokens (C88). The first design made the Go API the
backend-for-frontend: it completed the login, kept sessions, and set the cookie. That
puts browser sessions inside the API, although sessions are not the API's
responsibility, and it ties the API to cookies, CSRF, and session storage. The API
also needs to accept Hydra access tokens from non-browser clients (mobile, partners,
services) in any case.

## Decision

- A separate **backend-for-frontend (BFF) service** sits between browsers and the API.
  It completes the login with Hydra, keeps the session (PostgreSQL), sets the HttpOnly
  cookie, refreshes tokens, and forwards `/api/*` to the API with
  `Authorization: Bearer <access token>`, never the cookie.
- The **API accepts only Hydra Bearer tokens**, from the BFF and from any other client.
  It keeps no sessions and sets no cookies.
- The BFF **embeds its React app** (`go:embed`): one binary per release serves the app,
  `/api/auth/*`, and the proxy, on the app's own domains.
- **One BFF program, two instances**: `bff-app` (tenant domains, `apps/app`) and
  `bff-admin` (`apps/admin`), each with its own Hydra client, session settings, and
  embedded app.
- The BFF lives in the existing Go module as `apps/api/cmd/bff`, with its packages
  under `internal/bff`; it is a separate binary and container. It can move to its own
  module later.

## Consequences

- The API stays stateless and can be split or scaled separately; every client presents
  the same Bearer token.
- An extra hop for browser API calls (browser → BFF → API), and one more service per app
  in every deployment.
- The BFF now keeps Hydra's access and refresh tokens, encrypted in its sessions, and
  refreshes them.
- The API needs a token-validation decision (JWT verified locally or introspection).
- Frontend releases are tied to BFF releases (embedded app); in development the app
  still runs on Vite's dev server, with `/api` routed to the BFF.
- Chosen over the API as BFF (sessions in the API), Next.js app and admin as BFF (rewrite
  of the existing apps, session code in Node), and `oauth2-proxy` (tokens encrypted in
  cookies, per-domain configuration).
