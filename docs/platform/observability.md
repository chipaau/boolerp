# Tracing and logging

Status: runtime structured logging implemented in platform step 1. Tracing is
confirmed as required; its tooling and operational policy remain proposed.

Tracing explains the execution path and timing of a request or background operation.
Structured logs explain operational events. Business audit separately records
accountable changes.

## Implemented logging

- Standard-library `log/slog` handlers write to stdout. JSON is the default;
  `APP_LOG_FORMAT=text` selects readable text. `APP_LOG_LEVEL` controls filtering.
- The logger is constructed at the entry point and passed explicitly through
  bootstrap to the HTTP server. Standard HTTP server diagnostics use the same handler.
- Runtime events include `service=api`, environment, and the relevant address or
  shutdown timeout. Successful start, shutdown initiation, and shutdown completion
  are info events; startup/shutdown failures are error events.
- Configuration is validated before listening. Invalid configuration produces a
  JSON error using a fallback logger and exits nonzero, even if logging settings
  are invalid. Errors name the setting without repeating its supplied value.
- Structured attribute and group names containing `password`, `secret`, `token`,
  `credential`, `authorization`, `cookie`, `dsn`, `apikey`, `privatekey`, `accesskey`,
  or `signingkey`, or ending in `url`, have their values replaced with `[REDACTED]`.
  Matching ignores case, underscores, and hyphens. It also applies to attributes
  attached with `With` and groups created with `WithGroup`.

Redaction is based on attribute/group names. It does not inspect arbitrary
messages, error strings, maps, or structs stored under other keys. Call sites must
use deliberate safe fields and avoid logging raw configuration, headers, request
bodies, provider responses, or private employee content. The current runtime does
not read or log the reserved database/cache credentials.

See [runtime configuration](../development.md#runtime-configuration) for defaults
and validation. Request logs/correlation, tracing, and metrics are later increments.

## Proposed tracing baseline

- Request correlation and OpenTelemetry traces across inbound HTTP, application
  operations, PostgreSQL, Redis, and any selected provider calls.
- Propagated context for background work, with explicit tenant/actor scope.
- Optional external trace export for self-hosted installations.
- Optional metrics for request latency/errors, database pools, and cache behavior.

No collector or tracing backend is added to the four-service development Compose
configuration by this documentation.

## Open decisions

Choose instrumentation libraries, propagation conventions, trusted request-ID
handling, sampling, exporter/backend, retention, and default self-host behavior.
Decide what limited identifiers are permitted as attributes without exposing personal data.

Credentials, session tokens, employee payloads, and cache values must not be logged
or placed into trace attributes by default. Instrumentation should not make a remote
telemetry backend a hidden prerequisite for employee operations.

See [audit](audit.md), [caching](caching.md), and [deployment](deployment.md).
