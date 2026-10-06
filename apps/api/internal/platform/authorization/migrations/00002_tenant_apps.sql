-- Tenant apps (C116, C166; fields confirmed 2026-10-06): which apps each tenant has
-- turned on, with history. Turning an app off sets active_to; turning it on again is a
-- new row. Who turned it off is in the audit log. Only the operator tenant turns apps on
-- and off for now (the user's choice): apps follow what the customer bought (D10).
-- Turning an app on will copy its role templates into the tenant's roles (built with
-- roles).

-- +goose Up
CREATE TABLE tenant_apps (
    id           uuid        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id    uuid        NOT NULL DEFAULT current_tenant_id() REFERENCES tenants (id) ON DELETE RESTRICT,
    app_key      text        NOT NULL REFERENCES apps (key) ON DELETE RESTRICT,
    -- Null when provisioning or a seed turned it on.
    activated_by uuid        REFERENCES users (id) ON DELETE RESTRICT,
    active_from  timestamptz NOT NULL DEFAULT now(),
    active_to    timestamptz CHECK (active_to >= active_from),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),

    -- Tenant tables reference an activation with its tenant.
    UNIQUE (tenant_id, id)
);

-- At most one live activation per tenant and app; ended ones are history.
CREATE UNIQUE INDEX tenant_apps_one_live ON tenant_apps (tenant_id, app_key) WHERE active_to IS NULL;

CREATE TRIGGER tenant_apps_updated_at BEFORE UPDATE ON tenant_apps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose StatementBegin
-- An operator app only in the operator tenant; a retired app is never turned on; an
-- activation's tenant and app never change, and an ended one is frozen.
CREATE FUNCTION tenant_apps_valid() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    app apps%ROWTYPE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.app_key IS DISTINCT FROM OLD.app_key THEN
            RAISE EXCEPTION 'tenant app %: its tenant and app cannot change', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.active_to IS NOT NULL THEN
            RAISE EXCEPTION 'tenant app % has ended: it cannot change', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    SELECT * INTO app FROM apps WHERE key = NEW.app_key;
    IF app.active_to IS NOT NULL THEN
        RAISE EXCEPTION 'app % is retired: it cannot be turned on', NEW.app_key
            USING ERRCODE = 'check_violation';
    END IF;
    IF app.kind = 'operator' AND NOT lookup.is_operator_tenant(NEW.tenant_id) THEN
        RAISE EXCEPTION 'app % is for the operator tenant only', NEW.app_key
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER tenant_apps_valid BEFORE INSERT OR UPDATE ON tenant_apps
    FOR EACH ROW EXECUTE FUNCTION tenant_apps_valid();

-- Row-level security (C115): a tenant reads its own apps; the operator tenant reads
-- every tenant's and alone turns them on and off (the user's choice). Nothing deletes
-- one. Enabled, not forced: the owning migration role seeds them.
ALTER TABLE tenant_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_apps_read ON tenant_apps FOR SELECT
    USING (tenant_id = current_tenant_id() OR lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_apps_create ON tenant_apps FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_apps_update ON tenant_apps FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));

-- Every change is audited (C164).
SELECT audit.enable('tenant_apps');
