# 07 — Observability — SRS

**Status:** 🟡 In Review &nbsp;·&nbsp; Technical tracing / logging / metrics. **Distinct from the
business audit trail (→ 06).**

## Confirmed decisions (2026-08-13)
- **Self-host default = stdout structured logs, zero external backends required.** OTLP export + metrics
  are **opt-in** via config (so a non-expert on-prem operator needs nothing extra).
- SaaS points OTLP at a collector/backend.
- **Never log** credentials, tokens, or PII beyond IDs — redaction enforced.

## Functional requirements
| ID | Requirement |
|---|---|
| FR-OBS-01 | Structured logging via `log/slog`, JSON to stdout by default; a **request-scoped logger** carries correlation/request id + tenant id + user id. |
| FR-OBS-02 | **Correlation/request-ID** middleware; propagated through logs, traces, and outbound calls (Kratos, Cerbos). |
| FR-OBS-03 | **Distributed tracing** (OpenTelemetry); spans HTTP → DB → Kratos/Cerbos; **OTLP export opt-in** (off by default for self-host). |
| FR-OBS-04 | **Metrics** (request rate / latency / errors, DB pool); Prometheus endpoint opt-in. |
| FR-OBS-05 | `/healthz` (liveness) + `/readyz` (readiness) — shared with 01. |
| FR-OBS-06 | **Redaction:** secrets/tokens/PII never appear in logs or span attributes. |
| FR-OBS-07 | Optional error-reporting hook (off by default self-host). |

## Non-functional
- Sensible defaults so `compose up` on-prem yields useful stdout logs with **no configuration**.

## Open (resolve before 🟢)
- [ ] Default trace **sampling** strategy (proposed: 100% errors + parent-based sample).
- [ ] SaaS metrics/trace backend choice (Prometheus/Tempo/OTel collector).

## Use cases
See [`use-cases.md`](use-cases.md) — UC-OBS-01 … UC-OBS-06 (each with unit + integration + e2e per `testing.md`).
