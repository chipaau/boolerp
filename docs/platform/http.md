# HTTP foundation

Status: implemented (steps 2a-2f, H1, H2, C114); this describes the current behaviour.

Chi is the API HTTP framework (C19, [ADR 0002](../adr/0002-tool-and-provider-selection.md)).
`internal/bootstrap/http.go` builds the router and its middleware; the edition mounts
the modules' routes (C95); `internal/platform/kit/httpserver` serves any `http.Handler`.

## Routing and responses

Every response the API writes is JSON (C35); Go's own pre-handler protocol errors
(400, 431, 505) are plain text and are the only exception. Responses written by the
proxy in front of the API are not the API's: in particular, rate limiting is the
proxy's job (C81), and Traefik's `429` has a plain-text body with `Retry-After`. `GET /api/healthz` is a
normal route returning `200` `{"status":"ok"}`; `HEAD` is answered through
`chi/middleware.GetHead` (C36). `GET /api/readyz` reports dependency readiness:
`{"status":"ready"}` or a 503 problem response (C45). Successful health and readiness
checks are not request-logged; failed readiness checks are.

**Status (step 2d):** errors are RFC 9457 problem details (C37), written by
`problem.Error(w, r, status, detail)`:

```json
{"type":"about:blank","title":"Not Found","status":404,
 "detail":"No resource exists at this path.",
 "instance":"urn:uuid:01a0e954-861b-71d3-9eba-8c575de9436d"}
```

`instance` is the request ID, so a client can quote it and support can find the log
line. Unknown paths return 404; known paths with an unrouted method return 405 with
`Allow` (for example `GET, HEAD`). All responses carry `X-Content-Type-Options:
nosniff`. Mapping `*http.MaxBytesError` to 413 (and other body errors to 400/415)
is added with the first handler that reads a request body, together with its decoder.

**Status (step 2e):** `problem.Recoverer` (C38) sits directly inside the
request logger. A panic before the response starts is logged once at ERROR
(`panic recovered`, `request_id`, `stack`, and the panic described safely) and
answered with a 500 problem response; the request line is then logged with status
500. A panic after the response has started aborts the connection. Panics no longer
reach net/http's `ErrorLog`, so they are always logged through the redacted logger.

Routes are registered with chi's typed method helpers (`r.Get`, `r.Post`); path
parameters use chi's URL parameters. Successful JSON responses use `application/json`
and problem responses `application/problem+json`; authenticated answers carry
`Cache-Control: no-store` (chi's `middleware.NoCache`, C112). Internal errors, input
values, and private request URLs are never copied into problems.

## JSON-only responses

All application-level responses use JSON. Success payloads use
`application/json`; errors and redirects use `application/problem+json`
(RFC 9457). Protocol-level errors produced by Go's HTTP server before
handlers run (e.g. 431 for oversized headers) may not carry a JSON body.

## Correlation, logging, and recovery

**Status (step 2c):** implemented with libraries rather than the custom
wrapper described in the target contract below.

- `internal/platform/requestid` wraps `go-chi/traceid` (C33, C34). Every request
  after the liveness check gets a new UUIDv7, returned in `X-Request-Id`; any
  inbound `X-Request-Id` is deleted first, so clients cannot choose IDs.
  `requestid.FromContext(ctx)` exposes it, and the logger's handler adds it as
  `request_id` to every record logged with the request's context.
- `go-chi/httplog/v3` writes one record per request using OpenTelemetry attribute
  names (`SchemaOTEL`): method, `url.full`, `url.path`, `server.address`,
  `client.address`, user agent, status, duration, and body sizes, plus the
  `Content-Type`/`Origin` request headers and `Content-Type` response header.
  2xx/3xx log at INFO, 4xx at WARN (except 429), 5xx at ERROR. The liveness check
  is answered before the logger and is not logged. Panic recovery is left to step 2e
  (`RecoverPanics: false`).
- Request logs include the full URL (with query, sensitive parameters redacted), host,
  client address (from trusted proxy hops, C40), and user agent.

## Input limits and decoding

The default body limit is 1 MiB. A declared size above the limit is rejected
immediately. Unknown-length and chunked bodies are capped as they are read with
`http.MaxBytesReader`; handlers that consume JSON must use `DecodeJSON` and stop
when it returns false. Routes that do not consume a body do not parse it.

`DecodeJSON` requires uncompressed `application/json` (an absent or `identity`
content encoding), one JSON object, and fields recognized by the destination type.
It rejects empty input, `null`, arrays, malformed data, type mismatches, unknown
fields, and extra JSON values. Trailing whitespace counts toward the body limit.
It uses the standard `encoding/json` field matching and decoding semantics;
business-required fields and invariants belong to the domain/application layer.

| Failure | Status |
| --- | --- |
| Invalid JSON shape or fields | 400 |
| Body read deadline exceeded | 408 |
| Consumed or declared body too large | 413 |
| Unsupported content type or encoding | 415 |

Decoder checks use test-only routes. There is no public test/echo endpoint.

## Timeouts and protocol boundary

The defaults are 5 seconds for headers, 15 seconds for the full request read,
30 seconds for response writes, and 60 seconds between keep-alive requests.
See [runtime settings](../development.md#runtime-configuration) for overrides.
The server sets `MaxHeaderBytes` to 32 KiB; Go's parser applies this limit plus
4096 bytes of slack, so headers up to about 36 KiB are accepted.

**Status (step 2b):** `httpserver.NewServer` applies these deadlines and
`MaxHeaderBytes`, and routes the server's own diagnostics (for example handler
panics or TLS handshake errors) to the application logger at warn level (C31) through
`slog.NewLogLogger`. These arrive as one free-form `msg` string, so name-based
redaction does not apply to them; a panic value containing a secret would be
logged. Step 2e's panic recovery should intercept panics before net/http logs them. The body limit is `chi/middleware.RequestSize`, which wraps the
body in `http.MaxBytesReader`; a handler reading past the limit receives
`*http.MaxBytesError`; `httpinput.Decode` turns it into a `413` problem response (H2).
Every request's context also gets a deadline, `APP_HTTP_REQUEST_TIMEOUT` (25 seconds,
below the write timeout, C114): database, cache, and provider calls made with the
request's context fail once it passes, and the handler answers with its usual problem
response while the connection can still carry it. A small middleware sets only the
deadline. `chi/middleware.Timeout` is not used: after the handler it writes a bare 504
without a problem body, or a superfluous status when the handler has answered (a
verified gap against C35).

The server's deadlines above are network deadlines. They, and the request deadline, do
not preempt computation inside a handler that ignores its context. An expired write deadline can close the
connection without a JSON response. Requests rejected by the HTTP parser before
dispatch, including oversized headers, may receive Go's native error response
without a request ID. A common application error format does not replace protocol
handling. See [Go's HTTP server documentation](https://pkg.go.dev/net/http#Server).

## Browser and proxy policy

**Status (step 2f):**

- Paths match exactly (C39): no cleaning, no redirects; non-canonical paths are 404.
- Client IP (C40): `APP_HTTP_TRUSTED_PROXY_HOPS` selects chi's
  `ClientIPFromXFFTrustedProxies(n)`, or `ClientIPFromRemoteAddr` when `0`. The request
  log's `client.address` uses it. Traefik discards client-supplied `X-Forwarded-For`
  and appends the peer address, so Compose uses one hop.
- Cross-origin (C41): with `APP_HTTP_ALLOWED_ORIGINS` set, `go-chi/cors` answers
  preflights and lets those origins read responses (`X-Request-Id` exposed, no
  credentials yet). `http.CrossOriginProtection` rejects cross-origin POST, PUT,
  PATCH, and DELETE from any other origin with 403 problem details. CORS only controls
  what browsers let pages read; it does not stop non-browser clients, which are the
  job of authentication (D04).

This baseline does not verify tenant domains or authorize access. D04 still owns
session/cookie/CSRF and domain-login design; verified domain routing, trusted proxy
configuration, and any cross-origin login exceptions need their own agreed rules.

## Verification

Docker checks cover routing/HEAD/Allow behavior, matching response and log IDs,
private-data omission, JSON decoding, declared/chunked body limits, proxy spoofing,
origin checks, and panic recovery. Real TCP tests cover read/header/write/idle
deadlines, oversized headers, and connection abortion after a partial response.
Existing startup, configuration, and graceful/forced shutdown tests still pass.
