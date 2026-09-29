# Tracing and logging

Status: runtime logging and redaction are rebuilt in step 1b
(`internal/platform/observability`, C29). Request IDs and HTTP request logging are
rebuilt in step 2c (`internal/platform/requestid`, `go-chi/httplog`; C33, C34). Tracing is
confirmed as required; its tooling and operational policy remain proposed.

Tracing explains the execution path and timing of a request or background operation.
Structured logs explain operational events. Business audit separately records
accountable changes.

## Implemented logging

- Standard-library `log/slog` handlers write to stdout. JSON is the default;
  `APP_LOG_FORMAT=text` selects readable text. `APP_LOG_LEVEL` controls filtering.
- The logger is constructed at the entry point and passed explicitly. Passing it to
  the HTTP server's diagnostics and to `go-chi/httplog` request logs is step 2.
- Runtime events include `service=api`, environment, and the relevant address or
  shutdown timeout. Successful start, shutdown initiation, and shutdown completion
  are info events; startup/shutdown failures are error events.
- Configuration is validated before listening. Invalid configuration produces a
  JSON error using a fallback logger and exits nonzero, even if logging settings
  are invalid. Errors name the setting without repeating its supplied value.
- Structured attribute and group names containing `password`, `passwd`, `secret`,
  `token`, `credential`, `authorization`, `bearer`, `jwt`, `cookie`, `session`, `dsn`,
  `apikey`, `privatekey`, `accesskey`, `signingkey`, or `encryptionkey`, or ending in
  `url`, have their values replaced with `[REDACTED]`. The list lives in
  `internal/platform/observability/sensitive.go`. `session` intentionally over-redacts
  (for example `session_count`); a bare `key` is not listed because it would hide
  ordinary names such as `cache_key`.
  Matching ignores case, underscores, and hyphens. It also applies to attributes
  attached with `With` and groups created with `WithGroup`. This is implemented with
  slog's `HandlerOptions.ReplaceAttr` hook; the word list is the documented gap that
  slog does not provide.

Redaction is based on attribute/group names. Diagnostics from `net/http` (through
`http.Server.ErrorLog`) are a single message string and are not redacted; handler
panics no longer reach it, because `problem.Recoverer` logs them first (C38) without
the panic value. It does not inspect arbitrary
messages, error strings, maps, or structs stored under other keys. Call sites must
use deliberate safe fields and avoid logging raw configuration, headers, request
bodies, provider responses, or private employee content. The current runtime does
not read or log the reserved database/cache credentials.

See [runtime configuration](../development.md#runtime-configuration) for defaults
and validation. See [HTTP foundation](http.md) for generated request IDs, safe
request logs, and panic diagnostics. Tracing and metrics remain later increments.

## Tracing (step 5a)

`bootstrap/tracing.go` builds an OpenTelemetry tracer provider (C54) from the
standard `OTEL_*` variables (C55). With `OTEL_TRACES_EXPORTER` unset or `none`,
tracing is off and costs nothing; with `otlp` spans are batched and exported in the
background, and the last ones are flushed on shutdown (within 5 seconds, after the
HTTP server and dependencies close); `console` prints spans for local debugging.
Every span carries `service.name` (`bool-erp-api` unless `OTEL_SERVICE_NAME` is set).
Sampling is the SDK default, every request (C56). OpenTelemetry's own errors,
such as a failed export, are logged at WARN. PostgreSQL and Redis instrumentation follow
in step 5d.

**HTTP spans (step 5b):** `otelhttp` wraps the router, so each request has one server
span covering all middleware (C57). Spans are named by route pattern
(`GET /api/employees/{id}`) with `http.route`, method, status, and sizes; unmatched
requests are named by method only. Health and readiness checks are not traced, and
5xx responses mark the span as an error. A client's `traceparent` is recorded as a
link; the API always starts its own trace (C58).

**Log correlation (step 5c):** records logged with a traced, sampled request's
context carry `trace_id` and `span_id`, next to `request_id`; the request's span
carries `request.id` (C59). Without tracing, or for unsampled requests, logs carry
only `request_id`. The handler only reads the span: log records are never copied
into traces, so redaction cannot be bypassed (C60).

| Variable | Default here | Purpose |
| --- | --- | --- |
| `OTEL_TRACES_EXPORTER` | unset (off) | `otlp`, `console`, or `none` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | SDK default (`http://localhost:4318`) | Collector address when exporting over OTLP |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | or `grpc` |
| `OTEL_EXPORTER_OTLP_HEADERS` | none | For example a vendor API key; a secret |
| `OTEL_SERVICE_NAME` | `bool-erp-api` | Service name in the trace backend |
| `OTEL_TRACES_SAMPLER` / `_ARG` | `parentbased_always_on` | Sampling |

See the [OpenTelemetry environment variable specification](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/)
for the full list. Compose passes `OTEL_TRACES_EXPORTER`, `OTEL_EXPORTER_OTLP_ENDPOINT`,
and `OTEL_TRACES_SAMPLER` through only when they are set, because the SDK rejects
empty values.

## Proposed tracing baseline

- Request correlation and OpenTelemetry traces across inbound HTTP, application
  operations, PostgreSQL, Redis, and any selected provider calls.
- Propagated context for background work, with explicit tenant/actor scope.
- Optional external trace export for self-hosted installations.
- Optional metrics for request latency/errors, database pools, and cache behavior.

No collector or tracing backend is added to the four-service development Compose
configuration by this documentation.

## Open decisions

Choose instrumentation libraries, trace propagation, sampling, exporter/backend,
retention, and default self-host behavior. Any future acceptance of upstream
request IDs needs an explicit trust policy; step 2c always generates its own IDs (C33).
The request ID (`request_id`) is for support and log correlation; OpenTelemetry trace
IDs from step 5 will be a separate identifier unless a later decision merges them.
Decide what limited identifiers are permitted as attributes without exposing personal data.

Credentials, session tokens, employee payloads, and cache values must not be logged
or placed into trace attributes by default. Instrumentation should not make a remote
telemetry backend a hidden prerequisite for employee operations.

See [audit](audit.md), [caching](caching.md), and [deployment](deployment.md).
