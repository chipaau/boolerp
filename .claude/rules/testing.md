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
- Endpoint tests (C156) use the real router and PostgreSQL, fake authentication (test
  tokens), authorization (an Authorizer stating allow or deny), and every outside service,
  and assert the database after every write: `testdb.AssertHas` after create or update,
  `testdb.AssertMissing` after delete. Only adapter tests talk to a real outside service.
- Tests never depend on seeded or migrated data: each test creates the rows it needs in
  its rolled-back transaction (`testdb.Tx`, `testdb.OwnerTx`) with values that cannot
  clash with real data (C135).
- Do not require every use case to have redundant tests at every layer or claim a
  coverage percentage without measurement.
- Keep the API's total coverage (unit and feature tests, `cmd/*` excluded) at or above
  the threshold in `apps/api/.testcoverage.yml` (90%, C119, C143, C163); CI fails below it. Add
  tests with each change; raise the threshold when coverage rises, never lower it.
- Do not launch services or alter persisted data just to validate planning documents.
