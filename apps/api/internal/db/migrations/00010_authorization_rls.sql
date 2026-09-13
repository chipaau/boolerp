-- Real RLS for the three authorization tables where every row belongs to exactly one tenant, no
-- global/shared case (unlike roles: tenant_id NULL = a shared app-wide template, which is why roles
-- itself stays outside the RLS regime — a blanket tenant_id = current_tenant policy would hide the
-- global templates from everyone). user_roles/role_requests/support_access_grants all declared
-- tenant_id NOT NULL from the start (00008_authorization.sql) — this was simply never wired up.
-- +goose Up
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY user_roles_isolation ON user_roles
  USING      (tenant_id = ANY (current_setting('app.visible_tenants')::uuid[]))
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE role_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY role_requests_isolation ON role_requests
  USING      (tenant_id = ANY (current_setting('app.visible_tenants')::uuid[]))
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE support_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_access_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY support_access_grants_isolation ON support_access_grants
  USING      (tenant_id = ANY (current_setting('app.visible_tenants')::uuid[]))
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- +goose Down
DROP POLICY IF EXISTS support_access_grants_isolation ON support_access_grants;
ALTER TABLE support_access_grants NO FORCE ROW LEVEL SECURITY;
ALTER TABLE support_access_grants DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_requests_isolation ON role_requests;
ALTER TABLE role_requests NO FORCE ROW LEVEL SECURITY;
ALTER TABLE role_requests DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_isolation ON user_roles;
ALTER TABLE user_roles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
