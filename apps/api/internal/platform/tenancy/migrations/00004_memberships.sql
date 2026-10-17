-- Memberships (C160; fields confirmed 2026-10-05, invitations by e-mail 2026-10-17, C230): a
-- person's access to a tenant they work in. An invitation is an invited membership naming an
-- e-mail: it points at the user holding that verified address, or waits until an account
-- verifies it (then it is claimed: user_id set, active, joined_at). One account, many memberships (C115): each has its own status, and ending
-- one removes access to that tenant only. A membership is not employment: the employee
-- record is HRMS's. Portal users (students, patients) never become members (C133).
-- Seats are the tenant's invited and active memberships. A tenant has one or more owners
-- (C198): a tenant outside provisioning always keeps at least one, checked at commit. The
-- schema only: no membership is created by a migration (C135).

-- +goose Up
CREATE TABLE memberships (
    id                uuid        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id         uuid        NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    -- The identity module's user (C134 allows the foreign key to its stable id). Null only
    -- on an invitation not yet claimed (live, or ended unclaimed): an account verifying
    -- invite_email sets it once (C230).
    user_id           uuid        REFERENCES users (id) ON DELETE RESTRICT,
    -- The address invited and the name entered (C230): on every invitation, kept after
    -- joining as the record; personal data.
    invite_email      text        CHECK (invite_email = lower(invite_email) AND btrim(invite_email) <> ''),
    invite_name       text        CHECK (btrim(invite_name) <> ''),
    -- invited, then active; disabled is reversible (access paused in this tenant only);
    -- ended is final, kept as history. An expired invitation is an invited row whose
    -- invite_expires_at has passed, not a status.
    status            text        NOT NULL DEFAULT 'invited'
                      CHECK (status IN ('invited', 'active', 'disabled', 'ended')),
    -- An owner of the tenant's account (C198): it cannot be locked out, and other owners
    -- are added and removed by owners. A tenant may have several; one outside
    -- provisioning always has at least one (checked at commit, below).
    is_owner          boolean     NOT NULL DEFAULT false,
    -- Who invited them; null when provisioning or a seed created the membership.
    invited_by        uuid        REFERENCES users (id) ON DELETE RESTRICT,
    -- Null until the invitation is sent (when the tenant is activated, C228).
    invite_expires_at timestamptz,
    joined_at         timestamptz,
    disabled_at       timestamptz,
    ended_at          timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    -- Tenant tables (role assignments) reference a membership with its tenant.
    UNIQUE (tenant_id, id),
    -- Only an invitation waits without a user, and it names whom it is for; one cancelled
    -- or expired before anyone claimed it ends without one.
    CHECK (user_id IS NOT NULL OR status = 'invited' OR (status = 'ended' AND joined_at IS NULL)),
    CHECK (user_id IS NOT NULL OR (invite_email IS NOT NULL AND invite_name IS NOT NULL)),
    -- The status timestamps follow the status.
    CHECK (status NOT IN ('active', 'disabled') OR joined_at IS NOT NULL),
    CHECK (status <> 'disabled' OR disabled_at IS NOT NULL),
    CHECK (status <> 'ended' OR ended_at IS NOT NULL),
    -- An owner is invited or active: it stops being an owner before it is disabled or ended.
    CHECK (NOT is_owner OR status IN ('invited', 'active'))
);

-- One live membership per person and tenant; an ended one is history, never reused.
CREATE UNIQUE INDEX memberships_one_live ON memberships (tenant_id, user_id) WHERE status <> 'ended';
-- One live invitation per address and tenant (C230).
CREATE UNIQUE INDEX memberships_one_invitation ON memberships (tenant_id, invite_email) WHERE status = 'invited';
-- The invitations waiting on an address, which a newly verified address claims.
CREATE INDEX memberships_unclaimed ON memberships (invite_email) WHERE user_id IS NULL;
-- A tenant's owners (the "at least one owner" check below).
CREATE INDEX memberships_owners ON memberships (tenant_id) WHERE is_owner;
-- A person's memberships across tenants (the switcher, RequireMember).
CREATE INDEX memberships_user ON memberships (user_id);

CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A membership is one person in one tenant: its tenant never changes, its user is set once
-- (an invitation waiting on an address is claimed) and never changed after, and an ended
-- membership is frozen (rejoining is a new row).
-- +goose StatementBegin
CREATE FUNCTION memberships_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR (OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
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

-- At least one owner (C197, C198): a tenant outside provisioning has at least one invited or
-- active owner membership. The rule spans two tables, so it is a constraint trigger on each,
-- checked at commit, like the primary institution type (C138): within one transaction a
-- tenant can be given an owner and activated in either order, and owners can be swapped.
-- +goose StatementBegin
CREATE FUNCTION tenants_check_owner(tenant uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    tenant_status text;
BEGIN
    SELECT t.status INTO tenant_status FROM tenants t WHERE t.id = tenant;
    IF NOT FOUND OR tenant_status = 'provisioning' THEN
        RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM memberships m
                    WHERE m.tenant_id = tenant AND m.is_owner AND m.status IN ('invited', 'active')) THEN
        RAISE EXCEPTION 'tenant % is % without an owner', tenant, tenant_status
            USING ERRCODE = 'check_violation';
    END IF;
END;
$$;

CREATE FUNCTION tenants_owner_from_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM tenants_check_owner(NEW.id);
    RETURN NULL;
END;
$$;

CREATE FUNCTION tenants_owner_from_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM tenants_check_owner(OLD.tenant_id);
    RETURN NULL;
END;
$$;
-- +goose StatementEnd

CREATE CONSTRAINT TRIGGER tenants_have_owner
    AFTER INSERT OR UPDATE OF status ON tenants
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION tenants_owner_from_tenant();
CREATE CONSTRAINT TRIGGER memberships_keep_owner
    AFTER UPDATE OR DELETE ON memberships
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION tenants_owner_from_membership();

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
-- changes owner memberships and invitations of any tenant (provisioning, owner support,
-- inviting a tenant's administrators, C228), and nothing else outside its own tenant: a
-- member who is not an owner, and their history, are the tenant's alone. Cancelling an
-- invitation ends it, and the operator still sees that it ended. Nothing deletes a membership (it is ended). Enabled,
-- not forced, like the registry: the owning migration role provisions and seeds them.
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
-- +goose StatementBegin
-- The operator's share of another tenant's memberships: its owners, and its invitations,
-- live or ended without anyone joining (a cancelled or expired one).
CREATE FUNCTION memberships_operator_may(is_owner boolean, status text, joined_at timestamptz) RETURNS boolean
    LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
        SELECT lookup.is_operator_tenant(current_tenant_id())
           AND (is_owner OR status = 'invited' OR (status = 'ended' AND joined_at IS NULL))
    $$;
-- +goose StatementEnd
CREATE POLICY memberships_read ON memberships FOR SELECT
    USING (tenant_id = current_tenant_id() OR memberships_operator_may(is_owner, status, joined_at));
CREATE POLICY memberships_create ON memberships FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id() OR memberships_operator_may(is_owner, status, joined_at));
CREATE POLICY memberships_update ON memberships FOR UPDATE
    USING (tenant_id = current_tenant_id() OR memberships_operator_may(is_owner, status, joined_at))
    WITH CHECK (tenant_id = current_tenant_id() OR memberships_operator_may(is_owner, status, joined_at));

-- Every change is audited (C164).
SELECT audit.enable('memberships');
