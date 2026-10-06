-- Roles (C167; fields confirmed 2026-10-06): what a person may do in one app. A role
-- belongs to one app (an app has many roles) and grants only that app's capabilities
-- (role_capabilities). Global roles (tenant_id null) are Bool's, declared in each app's
-- code and mirrored by the authorization.roles seed file, matched by their key; a tenant
-- creates its own (tenant_id set) for anything else. Roles are never deleted: an
-- assignment and the audit log keep pointing at them; archiving retires one.

-- +goose Up
CREATE TABLE roles (
    id          uuid        PRIMARY KEY DEFAULT uuidv7(),
    -- Null: a global role, offered to every tenant with the app on. Set: that tenant's own.
    tenant_id   uuid        REFERENCES tenants (id) ON DELETE RESTRICT,
    app_key     text        NOT NULL REFERENCES apps (key) ON DELETE RESTRICT,
    -- A global role's stable name in code (hrms.admin), so the seed file finds the same
    -- row after a rename; a tenant's role has none.
    key         text        UNIQUE CHECK (key ~ '^[a-z][a-z0-9-]{1,30}\.[a-z][a-z0-9-]{0,60}$'),
    name        text        NOT NULL CHECK (btrim(name) <> ''),
    description text,
    archived_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CHECK ((tenant_id IS NULL) = (key IS NOT NULL)),
    CHECK (key IS NULL OR starts_with(key, app_key || '.'))
);

-- Names are unique among live roles: globally per app, and per tenant and app.
CREATE UNIQUE INDEX roles_global_name ON roles (app_key, lower(name))
    WHERE tenant_id IS NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX roles_tenant_name ON roles (tenant_id, app_key, lower(name))
    WHERE tenant_id IS NOT NULL AND archived_at IS NULL;

CREATE TRIGGER roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose StatementBegin
-- A role's tenant, app, and key never change. A tenant's role needs its app on in that
-- tenant, and its live name may not repeat a live global role's in the same app (the
-- user's choice); a global role added later may share a tenant role's name.
CREATE FUNCTION roles_valid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
                             OR NEW.app_key IS DISTINCT FROM OLD.app_key
                             OR NEW.key IS DISTINCT FROM OLD.key) THEN
        RAISE EXCEPTION 'role %: its tenant, app, and key cannot change', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM tenant_apps
                                         WHERE tenant_id = NEW.tenant_id AND app_key = NEW.app_key
                                           AND active_to IS NULL) THEN
        RAISE EXCEPTION 'app % is not on in this tenant', NEW.app_key
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.archived_at IS NULL AND EXISTS (SELECT 1 FROM roles g
                                            WHERE g.tenant_id IS NULL AND g.app_key = NEW.app_key
                                              AND g.archived_at IS NULL AND lower(g.name) = lower(NEW.name)) THEN
        RAISE EXCEPTION 'role name % is a global role''s', NEW.name
            USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER roles_valid BEFORE INSERT OR UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION roles_valid();

-- Row-level security (C115): a tenant reads its own roles and the global ones, and
-- creates and changes only its own (Cerbos decides who). Global roles are written only
-- by the seed file (the owning migration role). Nothing deletes a role.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_read ON roles FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = current_tenant_id());
CREATE POLICY roles_create ON roles FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY roles_update ON roles FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Every change is audited (C164); a global role's rows have no tenant.
SELECT audit.enable('roles');
