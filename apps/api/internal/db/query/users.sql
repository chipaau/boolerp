-- Platform identity projection (control-plane; not tenant-scoped). id = Kratos subject.

-- name: SyncUserOnLogin :one
-- Refresh the mirror from the Kratos identity traits and stamp the sign-in (UC-MEM-08).
-- UPDATE-only on purpose: there is no self-registration, so a user exists only because provisioning
-- or an invite created it. An unknown subject matches no row and returns pgx.ErrNoRows, which the
-- caller turns into 403 — authenticating with Kratos (password, passkey, or a future OIDC provider)
-- must never be enough to become a user of this system.
--
-- `status = 'active'` is enforced here too, so a disabled account is refused by our own check rather
-- than only by Kratos session revocation having worked (FR-MEM-05 / UC-AUTH-11). A live session for
-- a since-disabled user matches no row and is denied.
-- Credentials never touch this table — Kratos owns them.
UPDATE users SET
  email         = $2,
  name          = $3,
  name_i18n     = $4,
  phone         = $5,
  last_login_at = now(),
  updated_at    = now()
WHERE id = $1 AND status = 'active'
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: CreateUser :one
-- Provisioning-created user (owner) — the only path that brings a user into existence, alongside
-- the invite flow. Distinct from SyncUserOnLogin (the whoami mirror refresh): no
-- last_login_at — the user hasn't signed in yet. name_i18n omitted — defaults to '{}';
-- provisioning never sets it, same as it never set name_dv before.
INSERT INTO users (id, email, name, phone)
VALUES ($1, $2, $3, $4)
RETURNING *;
