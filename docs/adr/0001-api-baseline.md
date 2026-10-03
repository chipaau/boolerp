# ADR 0001: API baseline

Date: 2026-09-26.
Status: accepted for the confirmed scope below.

## Context

The API needs one current baseline for scope, structure, and required capabilities,
so that implementation assumptions, provider choices, and tenancy models from
earlier documents are not inherited by accident.

## Decision

Build the Go API in the existing monorepo with hexagonal module boundaries.
The current business scope is HRMS employee records; the platform backbone is
the primary design focus. PostgreSQL, Redis caching, audit, and tracing are required.
Frontend integration has started; its standards are not set yet (C128).

The development service set is api, app, postgres, and redis. (A starting set, not a
limit, C08; services are added when a step needs them.) All project
documentation lives under docs/, agent rules under .claude/, and root agent
entry points link to those sources.

Preserve SaaS, verified custom-domain, self-hosted same-release, English UI,
Dhivehi-content, and binary/container licensing requirements.

## Consequences

- Earlier implementations and archived approvals do not constrain the API.
- No employee or platform schema is approved by this ADR.
- Tenant semantics, isolation, persistence ports, operational contracts, and
  licensing details remain open. Confirmed frameworks and providers are recorded
  in [ADR 0002](0002-tool-and-provider-selection.md).
- Discuss the [open decisions](../decisions/README.md) one at a time.
- Keep earlier code and documents out of the repository (git history holds them).
- Do not claim code or example structures are implemented before they are built and validated.
