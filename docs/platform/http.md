# HTTP foundation

Chi is the selected API HTTP framework (C19, [ADR 0002](../adr/0002-tool-and-provider-selection.md)).
The platform step 2 foundation, implemented 2026-09-27, currently uses Go's
standard-library `http.ServeMux` and helpers in `internal/platform/httpserver`.
Migrate that routing foundation to chi in an authorized implementation increment
before adding business routes. No business endpoints were introduced in step 2.

## Routing and responses

The behavior below describes the current `ServeMux` implementation and is the
contract to preserve while moving routing to chi.

`GET /api/healthz` still returns `200` with `{"status":"ok"}`. `HEAD` returns the
same status and headers without a body. Routes use method-aware ServeMux patterns;
path parameters and canonical-path redirects retain the router's behavior.

Unknown routes return `404`. Unsupported methods return `405` with the router's
`Allow` header. Application-level HTTP failures use
[RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html):

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "request_id": "server-generated-correlation-id"
}
```

The media type is `application/problem+json`. Status matches the actual HTTP status;
an optional `detail` contains a safe explanation. Responses include
`Cache-Control: no-store`. Internal errors, input values, and private request URLs
are not copied into problems. Successful JSON responses use `application/json`.
`WriteJSON` encodes before committing a response and returns encoding/write errors
to the adapter. Employee-specific error mapping and validation remain part of D11.

## Correlation, logging, and recovery

- Every request reaching the handler receives a fresh random `X-Request-ID`.
  Incoming IDs are discarded. `RequestID(ctx)` makes the ID available to HTTP
  adapters; problem responses and request logs use the same value.
- Request logs record the registered route pattern, a bounded method label,
  status, bytes written, elapsed milliseconds, and whether the response was aborted.
  Status is zero if a request was aborted before any final response status.
  Raw paths, queries, hosts, headers, and bodies are omitted.
- Responses include `X-Content-Type-Options: nosniff`.
- A handler panic before response commitment becomes a generic `500`. Staged
  headers, including cookies and redirects, are discarded. Panic logs include a
  stack and correlation ID, but omit the panic value.
- A panic after commitment aborts the connection/stream instead of appending an
  error to a partial response. `http.ErrAbortHandler` retains its deliberate-abort
  behavior and does not generate a second panic diagnostic.

The wrapper supports `http.ResponseController` unwrapping and flush tracking.
Streaming endpoints and connection hijacking have no application contract yet.
Request IDs do not establish identity, tenant membership, or authorization.

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
The server sets `MaxHeaderBytes` to 32 KiB; Go's parser applies this limit.

These are network deadlines. They do not preempt computation inside a handler or
provide an application operation timeout. An expired write deadline can close the
connection without a JSON response. Requests rejected by the HTTP parser before
dispatch, including oversized headers, may receive Go's native error response
without a request ID. A common application error format does not replace protocol
handling. See [Go's HTTP server documentation](https://pkg.go.dev/net/http#Server).

## Browser and proxy policy

The API enables no cross-origin CORS access: it emits no allow-origin or
allow-credentials headers, and preflight requests receive ordinary routing errors.
Go's `CrossOriginProtection` rejects unsafe browser requests identified as
cross-origin, using Fetch Metadata and Origin headers, with a JSON `403`.
Safe methods and non-browser requests without those headers remain allowed.
There are no trusted-origin exceptions or bypass patterns.

`Forwarded`, `X-Forwarded-*`, `X-Real-IP`, and inbound `X-Request-ID` are removed
before routing. They cannot replace `Host`, `RemoteAddr`, or TLS state. A reverse
proxy must preserve the original Host for the current same-origin checks. The
peer address remains the proxy address; no client-IP attribution is claimed.

This baseline does not verify tenant domains or authorize access. D04 still owns
session/cookie/CSRF and domain-login design; verified domain routing, trusted proxy
configuration, and any cross-origin login exceptions need their own agreed rules.

## Verification

Docker checks cover routing/HEAD/Allow behavior, matching response and log IDs,
private-data omission, JSON decoding, declared/chunked body limits, proxy spoofing,
origin checks, and panic recovery. Real TCP tests cover read/header/write/idle
deadlines, oversized headers, and connection abortion after a partial response.
Existing startup, configuration, and graceful/forced shutdown tests still pass.
