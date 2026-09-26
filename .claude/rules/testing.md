# Validation rules

Read [testing.md](../../docs/testing.md).

- Validate the work actually changed. Documentation changes need link/status consistency
  and formatting checks; Compose changes need configuration validation.
- Test domain rules directly and application behavior through its ports.
- Verify database behavior against PostgreSQL, including tenant isolation under the
  restricted runtime role, transaction rollback, and concurrency where relevant.
- Substitutes for providers do not prove the providers' real integration behavior.
- Check that non-HTTP entry points receive the same access and tenant protections.
- Add browser tests when frontend integration becomes part of the scope.
- Do not require every use case to have redundant tests at every layer or claim a
  coverage percentage without measurement.
- Do not run previous API migrations, launch services, or alter persisted data just
  to validate planning documents.
