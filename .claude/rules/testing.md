# Validation rules

Read [testing.md](../../docs/testing.md).

- Validate the work actually changed. Documentation changes need link/status consistency
  and formatting checks; Compose changes need configuration validation.
- Test domain rules directly and application behavior through its ports.
- Verify database behavior against PostgreSQL, including tenant isolation under the
  restricted runtime role, transaction rollback, and concurrency where relevant.
- Substitutes for providers do not prove the providers' real integration behavior.
- Check that non-HTTP entry points receive the same access and tenant protections.
- End-to-end tests cover the integrated flows (C109); extend them with each integrated
  feature. Their wider scope is one of the integration standards still to set (C128).
- Do not require every use case to have redundant tests at every layer or claim a
  coverage percentage without measurement.
- Keep the API's total coverage (unit and feature tests, `cmd/*` excluded) at or above
  the threshold in `apps/api/.testcoverage.yml` (85%, C119); CI fails below it. Add
  tests with each change; raise the threshold when coverage rises, never lower it.
- Do not launch services or alter persisted data just to validate planning documents.
