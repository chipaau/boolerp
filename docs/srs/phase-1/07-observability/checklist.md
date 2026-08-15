# 07 — Observability — Confirmation Checklist

**Status:** 🟡 In Review &nbsp;·&nbsp; Technical tracing/logging/metrics (distinct from business audit → 06). `srs.md` + `use-cases.md` drafted.

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
- [ ] Scope confirmed &nbsp; [ ] Open questions resolved &nbsp; [ ] Use-case inventory complete
