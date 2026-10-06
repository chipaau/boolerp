-- Domains (C158; fields confirmed 2026-10-05): every host that opens a tenant's
-- workspace or one of its portals (C132). A host routes a request to its tenant; it
-- never proves access, which only an active membership does. Platform hosts are
-- subdomains of Bool's own domain (cyryx.bool.mv), active at once; custom hosts are
-- the customer's (workspace.cyryx.edu.mv), active once a DNS TXT record proves they
-- control it. Every active host serves directly (no redirect); the primary one per
-- tenant and per thing it serves is the address emails, jobs, and generated links
-- use. Product domains (findcare.mv) and the admin console are not tenants' domains
-- and are not here (C131, C142). The schema only: no domain is created by a
-- migration (C135).

-- +goose Up
CREATE TABLE domains (
    id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
    tenant_id          uuid        NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    -- Normalised by the application before it is stored or looked up: lowercase,
    -- international names in their ASCII (punycode) form, no port, no trailing dot.
    host               text        NOT NULL
                       CHECK (length(host) <= 253)
                       CHECK (host ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
    kind               text        NOT NULL CHECK (kind IN ('platform', 'custom')),
    -- workspace, or the key of a portal type an app defines in code (C132), such as
    -- academics.student; the application checks the key exists.
    serves             text        NOT NULL DEFAULT 'workspace'
                       CHECK (serves ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$'),
    status             text        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'revoked')),
    -- A random value the customer publishes as a TXT record at _bool-verify.<host>.
    verification_token text        CHECK (verification_token ~ '^[A-Za-z0-9_-]{32,}$'),
    verified_at        timestamptz,
    activated_at       timestamptz,
    revoked_at         timestamptz,
    is_primary         boolean     NOT NULL DEFAULT false,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),

    -- Only a custom host is verified, and it always has a token to verify with.
    CHECK ((kind = 'custom') = (verification_token IS NOT NULL)),
    -- The status timestamps follow the status.
    CHECK (status <> 'active' OR activated_at IS NOT NULL),
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL),
    CHECK (status <> 'active' OR kind = 'platform' OR verified_at IS NOT NULL),
    -- Only an active host can be the primary.
    CHECK (NOT is_primary OR status = 'active')
);

-- A host belongs to one tenant at a time; a revoked one can be claimed again.
CREATE UNIQUE INDEX domains_host ON domains (host) WHERE status <> 'revoked';
-- At most one primary per tenant and per thing it serves. The application keeps
-- exactly one while the tenant has an active host for it: revoking the primary
-- makes the platform host primary in the same transaction. A partial unique index
-- cannot be deferred, so a change of primary unflags the old row first.
CREATE UNIQUE INDEX domains_one_primary ON domains (tenant_id, serves) WHERE is_primary;
CREATE INDEX domains_tenant ON domains (tenant_id);

CREATE TRIGGER domains_updated_at BEFORE UPDATE ON domains
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A row is one host of one tenant: its host, kind, and tenant never change, or a
-- verified host could be swapped for an unverified one. A new host is a new row.
-- +goose StatementBegin
CREATE FUNCTION domains_identity_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.host IS DISTINCT FROM OLD.host OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
        RAISE EXCEPTION 'domain %: its host, kind, and tenant cannot change', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER domains_identity_locked BEFORE UPDATE OF host, kind, tenant_id ON domains
    FOR EACH ROW EXECUTE FUNCTION domains_identity_locked();

-- The request lookup, as erp_lookup (C131): before any tenant is known, which tenant
-- does an active host belong to, and what does it serve? Row-level security would
-- hide every row (no tenant yet), so this one narrow function reads past it. It
-- reads only the columns granted here and returns nothing for a pending, revoked,
-- or unknown host. The caller passes the host already normalised.
GRANT SELECT (host, tenant_id, serves, status) ON domains TO erp_lookup;
GRANT SELECT (code, status) ON tenants TO erp_lookup;
SET LOCAL ROLE erp_lookup;
-- +goose StatementBegin
CREATE FUNCTION lookup.tenant_by_host(requested text)
    RETURNS TABLE (tenant_id uuid, tenant_code text, tenant_status text, is_operator boolean, serves text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
        SELECT t.id, t.code, t.status, t.is_operator, d.serves
          FROM public.domains d
          JOIN public.tenants t ON t.id = d.tenant_id
         WHERE d.host = requested AND d.status = 'active'
    $$;
-- +goose StatementEnd
RESET ROLE;

-- Row-level security, as for tenants (C115): a tenant reads its own domains; the
-- operator tenant reads every domain and alone adds and changes them. A domain is
-- revoked, never deleted, so there is no delete policy. Enabled, not forced: part of
-- the registry its owner maintains.
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY domains_read ON domains FOR SELECT
    USING (tenant_id = current_tenant_id() OR lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY domains_create ON domains FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY domains_update ON domains FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));

-- Every change is audited (C164).
SELECT audit.enable('domains');
