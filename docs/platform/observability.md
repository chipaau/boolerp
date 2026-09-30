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
request logs, and panic diagnostics. Tracing (step 5) and metrics (H6) follow.

## Tracing (step 5a)

`bootstrap/tracing.go` builds an OpenTelemetry tracer provider (C54) from the
standard `OTEL_*` variables (C55). With `OTEL_TRACES_EXPORTER` unset or `none`,
tracing is off and costs nothing; with `otlp` spans are batched and exported in the
background, and the last ones are flushed on shutdown (within 5 seconds, after the
HTTP server and dependencies close); `console` prints spans for local debugging.
Every span carries `service.name` (`bool-erp-api` unless `OTEL_SERVICE_NAME` is set).
Sampling is the SDK default, every request (C56). OpenTelemetry's own errors,
such as a failed export, are logged at WARN. Database and cache spans are described
below (step 5d).

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

**PostgreSQL and Redis spans (step 5d):** a traced request's database queries and
cache commands appear as its child spans (C61). PostgreSQL spans record the SQL text
with placeholders, never parameter values; Redis spans record the command name only,
never arguments (cached values or keys). Instrumentation is attached only when
tracing is on. The background Redis reachability check at startup produces a few
standalone spans; readiness pings do not.

**Export failures (step 5e):** exporting never slows or fails requests; during a
collector outage up to 2,048 spans wait and newer ones are dropped. Export errors are
logged at WARN once, then at most once a minute with a `suppressed` count (C62).

**Viewing traces locally:** `docker compose up` starts `grafana/otel-lgtm` (the `lgtm`
service, C82, replacing Jaeger from C63), and the API exports traces and metrics to it
by default in development. Open `http://grafana.bool.test`, choose Explore and the
Tempo data source, and search for the `bool-erp-api` service; each trace shows the
request span with its PostgreSQL and Redis child spans, and the `request.id`
attribute matches the response's `X-Request-Id`. Set `OTEL_TRACES_EXPORTER=none` in
`.env` to stop exporting. Nothing is persisted, so data is gone when it restarts.

| Variable | Default here | Purpose |
| --- | --- | --- |
| `OTEL_TRACES_EXPORTER` | unset (off) | `otlp`, `console`, or `none` |
| `OTEL_METRICS_EXPORTER` | unset (off) | `otlp` (push), `prometheus` (pull), `console`, or `none` (C82) |
| `OTEL_METRIC_EXPORT_INTERVAL` | `60000` (ms) | How often metrics are pushed over OTLP |
| `OTEL_EXPORTER_PROMETHEUS_HOST` / `_PORT` | `localhost` / `9464` | Where the `prometheus` exporter serves `/metrics` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | SDK default (`http://localhost:4318`) | Collector address when exporting over OTLP |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | or `grpc` |
| `OTEL_EXPORTER_OTLP_HEADERS` | none | For example a vendor API key; a secret |
| `OTEL_SERVICE_NAME` | `bool-erp-api` | Service name in the trace backend |
| `OTEL_TRACES_SAMPLER` / `_ARG` | `parentbased_always_on` | Sampling |

See the [OpenTelemetry environment variable specification](https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/)
for the full list. In Compose, `OTEL_TRACES_EXPORTER` and `OTEL_METRICS_EXPORTER`
default to `otlp` and `OTEL_EXPORTER_OTLP_ENDPOINT` to `http://lgtm:4318` (C82);
`OTEL_TRACES_SAMPLER` is passed through only when set, because the SDK rejects empty
values.

## Metrics (H6)

`bootstrap/metrics.go` builds an OpenTelemetry meter provider from the same `OTEL_*`
variables (C82), chosen per deployment with `OTEL_METRICS_EXPORTER`: `otlp` pushes to a
collector every `OTEL_METRIC_EXPORT_INTERVAL`; `prometheus` serves `/metrics` for
scraping on its own listener (`OTEL_EXPORTER_PROMETHEUS_HOST:PORT`, default
`localhost:9464`), never on the API's routes or through the proxy. Unset or `none`
means off, with no SDK running. The last readings are pushed on shutdown.

| Group | Metrics | Source |
| --- | --- | --- |
| HTTP requests | `http.server.request.duration` (rate, errors by status, latency), request and response body sizes, by method, status, and `http.route` | `otelhttp` |
| Database queries | `db.client.operation.duration`, errors, by operation type (never SQL text) | `otelpgx` |
| Database pool | `pgxpool.*`: acquired, idle, and total connections, acquire waits and durations | `otelpgx.RecordStats` |
| Redis | `db.client.connections.*`: pool usage, waits, timeouts, command use time | `redisotel` |
| Go runtime | goroutines, memory, allocations, GC goal | `contrib/instrumentation/runtime` |

Request metrics carry the route pattern (`/api/employees/{id}`), added through
`otelhttp`'s `Labeler` by the same middleware that names spans, because `otelhttp`
cannot see chi's route. Unmatched requests carry no route, so raw paths never become
labels and the number of series stays bounded. Health and readiness checks are not
counted. Metric attributes never contain SQL text, parameters, cache keys or values,
or credentials (tested).

**Viewing metrics locally:** in Grafana (`http://grafana.bool.test`), choose Explore and
the Prometheus data source; names are converted to Prometheus style
(`http_server_request_duration_seconds`, `pgxpool_acquired_connections`,
`go_goroutine_count`). The first readings arrive about a minute after start.

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
