# Tracing and logging

Status: tracing is confirmed as required; tooling and operational policy proposed.

Tracing explains the execution path and timing of a request or background operation.
Structured logs explain operational events. Business audit separately records
accountable changes.

## Proposed baseline

- Structured Go slog logs to stdout.
- Request correlation and OpenTelemetry traces across inbound HTTP, application
  operations, PostgreSQL, Redis, and any selected provider calls.
- Propagated context for background work, with explicit tenant/actor scope.
- Optional external trace export for self-hosted installations.
- Optional metrics for request latency/errors, database pools, and cache behavior.

No collector or tracing backend is added to the four-service development Compose
configuration by this documentation.

## Open decisions

Choose logger/instrumentation libraries, propagation conventions, trusted request-ID
handling, sampling, exporter/backend, retention, and default self-host behavior.
Decide what limited identifiers are permitted as attributes without exposing personal data.

Credentials, session tokens, employee payloads, and cache values must not be logged
or placed into trace attributes by default. Instrumentation should not make a remote
telemetry backend a hidden prerequisite for employee operations.

See [audit](audit.md), [caching](caching.md), and [deployment](deployment.md).
