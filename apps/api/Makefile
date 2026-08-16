# Docker-first dev tasks for the Go API. The host needs only Docker.
SQLC_VERSION := 1.31.1

# Regenerate typed queries from internal/db/query/*.sql against the structural migrations.
.PHONY: sqlc
sqlc:
	docker run --rm -v "$(CURDIR)":/src -w /src sqlc/sqlc:$(SQLC_VERSION) generate

# Type-check the SQL/queries without writing generated code.
.PHONY: sqlc-vet
sqlc-vet:
	docker run --rm -v "$(CURDIR)":/src -w /src sqlc/sqlc:$(SQLC_VERSION) vet
