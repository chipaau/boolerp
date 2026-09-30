# ADR 0001: Fresh API baseline

Date: 2026-09-26.
Status: accepted for the confirmed scope below.

## Context

The API is being redesigned from scratch. Earlier documents mix implementation
assumptions, provider choices, incompatible tenancy models, and broader scope.
The rebuild needs one current baseline without inheriting those decisions.

## Decision

Use the existing monorepo for a fresh Go API with hexagonal module boundaries.
The current business scope is HRMS employee records; the platform backbone is
the primary design focus. PostgreSQL, Redis caching, audit, and tracing are required.
Frontend integration is deferred.

The development service set is api, app, postgres, and redis. All project
documentation lives under docs/, agent rules under .claude/, and root agent
entry points link to those sources.

Preserve SaaS, verified custom-domain, self-hosted same-release, English UI,
Dhivehi-content, and binary/container licensing requirements.

## Consequences

- Previous implementation and archived approvals do not constrain the new API.
- No employee or platform schema is approved by this ADR.
- Tenant semantics, isolation, persistence ports, operational contracts, and
  licensing details remain open. Confirmed frameworks and providers are recorded
  in [ADR 0002](0002-tool-and-provider-selection.md).
- Discuss the [open decisions](../decisions/README.md) one at a time.
- Keep previous documents out of the repository (git history holds them); only
  `apps/api.bak/` remains, excluded from new-API builds.
- Do not claim existing code or example structures are an implemented rebuild.
