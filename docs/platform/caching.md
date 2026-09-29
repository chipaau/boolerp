# Redis caching

Status: Redis caching is confirmed as required. The Redis foundation is built
(step 4): client `go-redis` v9 (C51), optional at runtime with fail-fast fallback to
PostgreSQL (C52), and separate `APP_REDIS_*` settings (C53). What is cached, keys,
TTLs, and invalidation remain open until a concrete read is chosen (step 11).

## Redis foundation (step 4)

`internal/platform/redis.NewClient` builds a lazy client: the API starts, and stays
ready, while Redis is down. Each call makes one connection attempt and no retries,
bounded by `APP_REDIS_TIMEOUT` and the request's deadline, so a cache outage costs
about the timeout per call instead of the tens of seconds go-redis's defaults can
take. `main` checks reachability once in the background at startup and logs
`redis reachable` or a WARN, and closes the client after HTTP shutdown. go-redis's
own diagnostics go to the application logger at WARN. Readiness does not include
Redis.

PostgreSQL remains the business system of record. Cache contents are replaceable;
audit history and committed employee records must not depend on Redis persistence.

## Proposed architecture

Place Redis connection/configuration infrastructure under
`internal/platform/cache/redis/`. Application code uses a narrow cache port or an
adapter decorating a read port; it does not import a Redis client.

Define cache behavior around a concrete read use case. Do not introduce a universal
cache framework or cache every employee query automatically.

## Isolation and consistency

- Tenant-scoped keys include tenant identity, operation, query parameters, and any
  actor/visibility variation that affects the response.
- A cache hit never grants access or replaces the application's authorization check.
- Invalidate or update after commit; rolled-back changes must not populate the cache.
- Specify expiry and recovery for failed invalidation after commit.
- Include cross-tenant, differing-permission, stale-result, and Redis-outage tests.
- Avoid personal information in keys and sensitive cached payloads without an explicit policy.

## Open decisions

Choose initial cached data, TTLs, key/version format, invalidation strategy,
stampede control, failure behavior, Redis client, memory limits, and eviction.
Decide whether security-related data may be cached and the resulting revocation guarantee.

For ordinary read caching, falling back to PostgreSQL on Redis failure is proposed.
That proposal does not apply automatically to security controls or rate limits.
The current development Redis service is ephemeral; it is not a selected job queue.

See [authorization](authorization.md), [execution](execution.md), and [observability](observability.md).
