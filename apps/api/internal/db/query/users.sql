-- Platform identity projection (control-plane; not tenant-scoped). id = Kratos subject.

-- name: UpsertUser :one
-- JIT-upsert the Kratos identity into platform.users on whoami (self-healing mirror).
-- Credentials never touch this table — Kratos owns them.
INSERT INTO users (id, email, name, name_i18n, phone, last_login_at)
VALUES ($1, $2, $3, $4, $5, now())
ON CONFLICT (id) DO UPDATE SET
  email         = EXCLUDED.email,
  name          = EXCLUDED.name,
  name_i18n     = EXCLUDED.name_i18n,
  phone         = EXCLUDED.phone,
  last_login_at = now(),
  updated_at    = now()
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: CreateUser :one
-- Provisioning-created user (owner). Distinct from UpsertUser (JIT whoami mirror): no
-- last_login_at — the user hasn't signed in yet. name_i18n omitted — defaults to '{}';
-- provisioning never sets it, same as it never set name_dv before.
INSERT INTO users (id, email, name, phone)
VALUES ($1, $2, $3, $4)
RETURNING *;
