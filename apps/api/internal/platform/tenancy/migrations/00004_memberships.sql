-- Memberships (C160; fields confirmed 2026-10-05): a person's access to a tenant they
-- work in. One account, many memberships (C115): each has its own status, and ending
-- one removes access to that tenant only. A membership is not employment: the employee
-- record is HRMS's. Portal users (students, patients) never become members (C133).
-- Seats are the tenant's invited and active memberships. The schema only: no membership
-- is created by a migration (C135).

-- +goose Up
CREATE TABLE memberships (
    id                uuid        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         uuid        NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    -- The identity module's user (C134 allows the foreign key to its stable id). An
    -- invitation always names an account: inviting someone without one creates it first.
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    -- invited, then active; disabled is reversible (access paused in this tenant only);
    -- ended is final, kept as history. An expired invitation is an invited row whose
    -- invite_expires_at has passed, not a status.
    status            text        NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited', 'active', 'disabled', 'ended')),
    -- One owner per tenant, changed only by a dedicated transfer.
    is_owner          boolean     NOT NULL DEFAULT false,
    -- Who invited them; null when provisioning or a seed created the membership.
    invited_by        uuid        REFERENCES users (id) ON DELETE RESTRICT,
    invite_expires_at timestamptz,
    joined_at         timestamptz,
    disabled_at       timestamptz,
    ended_at          timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    -- Tenant tables (role assignments) reference a membership with its tenant.
    UNIQUE (tenant_id, id),
    -- The status timestamps follow the status.
    CHECK (status <> 'invited' OR invite_expires_at IS NOT NULL),
    CHECK (status NOT IN ('active', 'disabled') OR joined_at IS NOT NULL),
    CHECK (status <> 'disabled' OR disabled_at IS NOT NULL),
    CHECK (status <> 'ended' OR ended_at IS NOT NULL),
    -- The owner is invited or active: never disabled or ended without a transfer.
    CHECK (NOT is_owner OR status IN ('invited', 'active'))
);

-- One live membership per person and tenant; an ended one is history, never reused.
CREATE UNIQUE INDEX memberships_one_live ON memberships (tenant_id, user_id) WHERE status <> 'ended';
-- At most one owner per tenant. A partial unique index cannot be deferred, so a
-- transfer unflags the old owner before flagging the new one.
CREATE UNIQUE INDEX memberships_one_owner ON memberships (tenant_id) WHERE is_owner;
-- A person's memberships across tenants (the switcher, RequireMember).
CREATE INDEX memberships_user ON memberships (user_id);

CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A membership is one person in one tenant: its tenant and user never change, and an
-- ended membership is frozen (rejoining is a new row).
-- +goose StatementBegin
CREATE FUNCTION memberships_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'membership %: its tenant and user cannot change', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status = 'ended' THEN
        RAISE EXCEPTION 'membership % has ended: it cannot change', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER memberships_locked BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION memberships_locked();

-- The lookups, as erp_lookup (C131): they run before the request's tenant is set (row-
-- level security would hide every row), each reading only the columns granted here.
GRANT SELECT (id, tenant_id, user_id, status, is_owner) ON memberships TO erp_lookup;
GRANT SELECT (name) ON tenants TO erp_lookup;
GRANT SELECT (is_primary) ON domains TO erp_lookup;
SET LOCAL ROLE erp_lookup;
-- +goose StatementBegin
-- RequireMember (C144): the person's active membership in the tenant and the tenant's
-- status, in one call before the request's transaction; nothing when they have none.
CREATE FUNCTION lookup.active_membership(tenant uuid, member uuid)
    RETURNS TABLE (membership_id uuid, is_owner boolean, tenant_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
        SELECT m.id, m.is_owner, t.status
          FROM public.memberships m
          JOIN public.tenants t ON t.id = m.tenant_id
         WHERE m.tenant_id = tenant AND m.user_id = member AND m.status = 'active'
    $$;

-- The switcher: the person's active memberships across tenants, each with the tenant's
-- primary workspace host (null if it has none active).
CREATE FUNCTION lookup.memberships_of(member uuid)
    RETURNS TABLE (membership_id uuid, tenant_id uuid, tenant_code text, tenant_name text,
                   tenant_status text, is_owner boolean, workspace_host text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
        SELECT m.id, t.id, t.code, t.name, t.status, m.is_owner,
               (SELECT d.host FROM public.domains d
                 WHERE d.tenant_id = t.id AND d.serves = 'workspace' AND d.is_primary AND d.status = 'active')
          FROM public.memberships m
          JOIN public.tenants t ON t.id = m.tenant_id
         WHERE m.user_id = member AND m.status = 'active'
         ORDER BY t.name
    $$;
-- +goose StatementEnd
RESET ROLE;

-- Row-level security (C115): members read their tenant's memberships and, subject to
-- authorization, add and change them; the operator tenant also reads, creates, and
-- changes owner memberships of any tenant (provisioning, owner support), and nothing
-- else outside its own tenant. Nothing deletes a membership (it is ended). Enabled,
-- not forced, like the registry: the owning migration role provisions and seeds them.
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_read ON memberships FOR SELECT
    USING (tenant_id = current_tenant_id()
           OR (is_owner AND lookup.is_operator_tenant(current_tenant_id())));
CREATE POLICY memberships_create ON memberships FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id()
                OR (is_owner AND lookup.is_operator_tenant(current_tenant_id())));
CREATE POLICY memberships_update ON memberships FOR UPDATE
    USING (tenant_id = current_tenant_id()
           OR (is_owner AND lookup.is_operator_tenant(current_tenant_id())))
    WITH CHECK (tenant_id = current_tenant_id()
                OR (is_owner AND lookup.is_operator_tenant(current_tenant_id())));
