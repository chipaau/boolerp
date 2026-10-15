-- Role capabilities (C169; fields confirmed 2026-10-06): which capabilities each role
-- grants, one row per pair. Adding a capability inserts a row; removing it deletes the
-- row (the audit log keeps the history); rows are never updated. tenant_id is always the
-- role's (null for a global role), so row-level security and the audit attribute the
-- change to the tenant.

-- +goose Up
CREATE TABLE role_capabilities (
    role_id    uuid        NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    capability text        NOT NULL REFERENCES capabilities (key) ON DELETE RESTRICT,
    -- The role's tenant, set by the trigger whatever the caller sends.
    tenant_id  uuid        REFERENCES tenants (id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, capability)
);

-- +goose StatementBegin
-- The tenant is the role's; the capability belongs to the role's app and is not
-- retired; rows are added and removed, never changed.
CREATE FUNCTION role_capabilities_valid() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    role_app    text;
    role_tenant uuid;
    cap_app     text;
    cap_retired boolean;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'a role capability is added or removed, never changed'
            USING ERRCODE = 'check_violation';
    END IF;
    SELECT app_key, tenant_id INTO role_app, role_tenant FROM roles WHERE id = NEW.role_id;
    SELECT app_key, active_to IS NOT NULL INTO cap_app, cap_retired FROM capabilities WHERE key = NEW.capability;
    NEW.tenant_id := role_tenant;
    IF cap_app IS DISTINCT FROM role_app THEN
        RAISE EXCEPTION 'capability % is not one of app %''s', NEW.capability, role_app
            USING ERRCODE = 'check_violation';
    END IF;
    IF cap_retired THEN
        RAISE EXCEPTION 'capability % is retired', NEW.capability
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER role_capabilities_valid BEFORE INSERT OR UPDATE ON role_capabilities
    FOR EACH ROW EXECUTE FUNCTION role_capabilities_valid();

-- Row-level security (C115): a tenant reads its own roles' capabilities and the global
-- roles', and adds and removes only its own roles' (Cerbos decides who). Global roles'
-- capabilities come only from the seed file.
ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_capabilities_read ON role_capabilities FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY role_capabilities_create ON role_capabilities FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY role_capabilities_delete ON role_capabilities FOR DELETE
    USING (tenant_id = current_tenant_id());

-- Every change is audited (C164).
SELECT audit.enable('role_capabilities');
