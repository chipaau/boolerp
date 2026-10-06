-- Role assignments (C116, C170; fields confirmed 2026-10-06): who holds which role, and
-- when. An assignment belongs to a membership in the same tenant (no membership, no role),
-- so a role ends with its membership and never carries into a later one. Time-bounded:
-- revoking, or an acting appointment ending, sets active_to; giving the role again is a
-- new row. Never deleted; who revoked it is in the audit log. Capabilities count only
-- assignments live now, whose membership is active and whose role's app is on.

-- +goose Up
CREATE TABLE role_assignments (
    id            uuid        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id     uuid        NOT NULL DEFAULT current_tenant_id() REFERENCES tenants (id) ON DELETE RESTRICT,
    membership_id uuid        NOT NULL,
    role_id       uuid        NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
    -- Null when provisioning or a seed assigned it.
    assigned_by   uuid        REFERENCES users (id) ON DELETE RESTRICT,
    active_from   timestamptz NOT NULL DEFAULT now(),
    active_to     timestamptz CHECK (active_to >= active_from),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    -- The membership is in the same tenant.
    FOREIGN KEY (tenant_id, membership_id) REFERENCES memberships (tenant_id, id) ON DELETE RESTRICT
);

-- One open assignment per membership and role.
CREATE UNIQUE INDEX role_assignments_one_open ON role_assignments (membership_id, role_id) WHERE active_to IS NULL;
-- A membership's roles, for working out its capabilities.
CREATE INDEX role_assignments_membership ON role_assignments (membership_id);

CREATE TRIGGER role_assignments_updated_at BEFORE UPDATE ON role_assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose StatementBegin
-- The role is global or this tenant's own, not archived, and of an app that is on in the
-- tenant; tenant, membership, and role never change; an ended assignment is frozen.
CREATE FUNCTION role_assignments_valid() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    r roles%ROWTYPE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.membership_id IS DISTINCT FROM OLD.membership_id
           OR NEW.role_id IS DISTINCT FROM OLD.role_id THEN
            RAISE EXCEPTION 'role assignment %: its tenant, membership, and role cannot change', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.active_to IS NOT NULL THEN
            RAISE EXCEPTION 'role assignment % has ended: it cannot change', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    SELECT * INTO r FROM roles WHERE id = NEW.role_id;
    IF r.tenant_id IS NOT NULL AND r.tenant_id <> NEW.tenant_id THEN
        RAISE EXCEPTION 'role % belongs to another tenant', NEW.role_id
            USING ERRCODE = 'check_violation';
    END IF;
    IF r.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'role % is archived', NEW.role_id
            USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM tenant_apps WHERE tenant_id = NEW.tenant_id AND app_key = r.app_key
                                               AND active_to IS NULL) THEN
        RAISE EXCEPTION 'app % is not on in this tenant', r.app_key
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER role_assignments_valid BEFORE INSERT OR UPDATE ON role_assignments
    FOR EACH ROW EXECUTE FUNCTION role_assignments_valid();

-- Row-level security (C115): a tenant reads and changes only its own assignments (Cerbos
-- decides who); nothing deletes one.
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_assignments_read ON role_assignments FOR SELECT
    USING (tenant_id = current_tenant_id());
CREATE POLICY role_assignments_create ON role_assignments FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY role_assignments_update ON role_assignments FOR UPDATE
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());

-- Every change is audited (C164).
SELECT audit.enable('role_assignments');
