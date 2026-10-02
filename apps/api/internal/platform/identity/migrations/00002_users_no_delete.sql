-- Users cannot be deleted by the API (security review 2026-10-03). The runtime
-- role's default privileges include DELETE on every table; nothing in the API
-- deletes a user, and a person's record must survive for audit. Row-level
-- security allows reading, creating, and updating users (users are global, not
-- tenant-scoped), and has no DELETE policy, so a delete as the runtime role
-- matches no rows. It is enabled but not forced: the owning migration role can
-- still maintain the table.

-- +goose Up
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_read ON users FOR SELECT USING (true);
CREATE POLICY users_create ON users FOR INSERT WITH CHECK (true);
CREATE POLICY users_update ON users FOR UPDATE USING (true) WITH CHECK (true);
