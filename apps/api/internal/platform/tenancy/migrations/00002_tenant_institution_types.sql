-- A tenant's institution types (C141; fields confirmed 2026-10-04): every kind of
-- organisation it is, the primary one flagged (it drives reporting, provisioning
-- defaults, and the tenant's main sector). FindCare and other searches match any of
-- them (C138). Part of the registry the operator maintains.

-- +goose Up
CREATE TABLE tenant_institution_types (
    tenant_id        uuid        NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    institution_type text        NOT NULL REFERENCES institution_types (code) ON DELETE RESTRICT,
    is_primary       boolean     NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, institution_type)
);

-- At most one primary per tenant. A partial unique index cannot be deferred, so a
-- change of primary unflags the old row before flagging the new one.
CREATE UNIQUE INDEX tenant_institution_types_one_primary ON tenant_institution_types (tenant_id)
    WHERE is_primary;
-- Every tenant of a type (FindCare's search).
CREATE INDEX tenant_institution_types_type ON tenant_institution_types (institution_type);

CREATE TRIGGER tenant_institution_types_updated_at BEFORE UPDATE ON tenant_institution_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- At least one primary: a tenant outside provisioning has exactly one primary type.
-- The rule spans two tables, so it is a constraint trigger on each, checked at
-- commit: within one transaction a tenant can be activated and given its primary in
-- either order, and the primary can be swapped.
-- +goose StatementBegin
CREATE FUNCTION tenants_check_primary_type(tenant uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    tenant_status text;
BEGIN
    SELECT t.status INTO tenant_status FROM tenants t WHERE t.id = tenant;
    IF NOT FOUND OR tenant_status = 'provisioning' THEN
        RETURN;
    END IF;
    IF (SELECT count(*) FROM tenant_institution_types it
         WHERE it.tenant_id = tenant AND it.is_primary) <> 1 THEN
        RAISE EXCEPTION 'tenant % is % without a primary institution type', tenant, tenant_status
            USING ERRCODE = 'check_violation';
    END IF;
END;
$$;

CREATE FUNCTION tenants_primary_type_from_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM tenants_check_primary_type(NEW.id);
    RETURN NULL;
END;
$$;

CREATE FUNCTION tenants_primary_type_from_type() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM tenants_check_primary_type(OLD.tenant_id);
    RETURN NULL;
END;
$$;
-- +goose StatementEnd

CREATE CONSTRAINT TRIGGER tenants_have_primary_type
    AFTER INSERT OR UPDATE OF status ON tenants
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION tenants_primary_type_from_tenant();
CREATE CONSTRAINT TRIGGER tenant_institution_types_keep_primary
    AFTER UPDATE OR DELETE ON tenant_institution_types
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION tenants_primary_type_from_type();

-- Row-level security, as for tenants (C115): a tenant reads its own rows; the
-- operator tenant reads every row and alone adds, changes, and removes them.
-- Enabled, not forced: part of the registry its owner maintains.
ALTER TABLE tenant_institution_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_institution_types_read ON tenant_institution_types FOR SELECT
    USING (tenant_id = current_tenant_id() OR lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_institution_types_create ON tenant_institution_types FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_institution_types_update ON tenant_institution_types FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenant_institution_types_delete ON tenant_institution_types FOR DELETE
    USING (lookup.is_operator_tenant(current_tenant_id()));

-- Every change is audited (C164).
SELECT audit.enable('tenant_institution_types');
