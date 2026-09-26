# 07 — Observability — Confirmation Checklist

**Status:** ✅ Implemented (mechanism), 🟡 policy questions still open (2026-09-12) &nbsp;·&nbsp;
Technical tracing/logging/metrics (distinct from business audit → 06). `internal/observability`:
`SetupTracing` (OTLP opt-in, no-op otherwise), `DBTracer` (pgx spans) + `otelhttp` transport on the
Kratos/Cerbos clients (UC-OBS-02's "HTTP → DB → Kratos/Cerbos" chain), `RequestLogger` +
`NewRedactingHandler` (code-enforced redaction, not just convention — UC-OBS-03), `MetricsMiddleware`
+ `RegisterPoolMetrics` behind an opt-in `/metrics` (UC-OBS-05). `tenant_id` isn't in the logger yet —
no tenant-scoped route resolves one to add. UC-OBS-04 (health/readiness) predates this component.

## Scope
- **In:** distributed tracing (OpenTelemetry), structured logging (`log/slog`) with correlation/
  request IDs + tenant/user context, metrics, health/readiness endpoints, error reporting.
- **Out:** business audit trail (→ 06).

## Candidate use cases
- UC-OBS-01 — Every request carries a correlation ID propagated through logs + traces
- UC-OBS-02 — Traces span HTTP → DB → Kratos/Cerbos calls
- UC-OBS-03 — Logs include tenant + user context (never secrets/PII beyond IDs)
- UC-OBS-04 — Health/readiness endpoints for compose/orchestration
- UC-OBS-05 — Metrics exposed (request rate/latency/errors, DB pool)

## ⚠️ Likely-missing / confirm
- Self-host story: OTel collector optional? sane defaults with no external backend?
- Log sink for on-prem (stdout only?) vs SaaS (aggregator)
- PII/secret redaction policy in logs
- Sampling strategy for traces

## Open questions
- [x] Self-host = **stdout structured logs, zero external backends**; OTLP/metrics opt-in.
- [x] Redaction: never log secrets/tokens/PII beyond IDs.
- [ ] Default trace sampling strategy.
- [ ] SaaS metrics/trace backend choice.

## Data-model touchpoints
- None (infrastructure).

## Sign-off
- [x] Scope confirmed &nbsp; [ ] Open questions resolved (sampling strategy + SaaS backend choice
  remain genuinely open policy decisions) &nbsp; [x] Use-case inventory complete
- [x] **Implemented** (2026-09-12): `internal/observability/{tracing,dbtracer,logging,metrics}.go`,
  tested (`internal/observability/{logging,metrics}_test.go`). See status line above for scope.
