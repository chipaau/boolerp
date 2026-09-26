# 07 — Observability — Use Cases

**Status:** 🟡 In Review. Actors: **Chi**, **Ops** (orchestrator / operator).

---

## UC-OBS-01 — Correlation id through logs + traces *(system)*
- **Trigger:** any request. · **Main flow:** middleware assigns/propagates a correlation id; every log line
  and span for the request carries it (+ tenant + user id). · **Postcondition:** a request is traceable end-to-end by one id.

## UC-OBS-02 — Trace spans HTTP → DB → Kratos/Cerbos *(system)*
- **Main flow:** a root HTTP span nests DB queries and outbound Kratos/Cerbos calls. · **Postcondition:** latency is attributable per dependency.

## UC-OBS-03 — Logs carry context, never secrets *(system)*
- **Main flow:** the request logger includes tenant + user ids; redaction strips secrets/tokens/PII. ·
  **Exceptions:** a redaction miss is a bug + test failure. · **Postcondition:** logs are useful and safe.

## UC-OBS-04 — Health & readiness *(Ops)*
- **Main flow:** `/healthz` = alive; `/readyz` = DB + Kratos + Cerbos reachable. · **Postcondition:** orchestrator routes traffic only when ready.

## UC-OBS-05 — Metrics exposed *(Ops)*
- **Main flow:** request rate/latency/error + DB-pool metrics available (opt-in endpoint). · **Postcondition:** operators can monitor the service.

## UC-OBS-06 — Self-host with zero external backends *(Ops)*
- **Trigger:** on-prem `compose up` with no observability config. · **Main flow:** structured stdout logs work
  out of the box; tracing/metrics stay off until configured. · **Postcondition:** non-expert operators get useful logs with no setup.

---

## ⚠️ Open items
- Default sampling strategy.
- SaaS metrics/trace backend choice.
