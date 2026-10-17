-- Apps (C165; fields and rows confirmed 2026-10-06, is_default 2026-10-15, C204,
-- is_available 2026-10-17, C225): the
-- catalogue of Bool's apps that tenants activate, mirrored from code. Tenancy owns it with
-- tenant_apps (C206): which apps exist and which a tenant has on; the authorization module
-- references it for what each app grants (capabilities, roles). The code is the source of
-- truth (each module declares its app as an authorization.App; the edition lists them);
-- the tenancy.apps seed file writes the edition's apps here on every cmd/deploy and
-- cmd/seed, so tenant_apps, capabilities, and roles can reference them. Global, not tenant-scoped. An app that leaves the code gets active_to;
-- none is ever deleted, so history keeps resolving.

-- +goose Up
CREATE TABLE apps (
    key         text        PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9-]{1,30}$'),  -- the frontend manifest's slug
    name        text        NOT NULL CHECK (btrim(name) <> ''),
    -- workspace: used by a tenant's members in its workspace; operator: only the operator
    -- tenant may activate it (the admin console); product: a separate product across
    -- tenants on Bool's own domain (FindCare).
    kind        text        NOT NULL CHECK (kind IN ('workspace', 'operator', 'product')),
    description text,
    -- Turned on for every tenant when it is created (C204); only a workspace app can be.
    -- It applies to tenants created afterwards, and a tenant may turn it off later.
    is_default  boolean     NOT NULL DEFAULT false CHECK (NOT is_default OR kind = 'workspace'),
    -- A tenant may have it turned on (C225); false lists it as coming soon. A new app is not
    -- available until its code says so, and a default app must be.
    is_available boolean    NOT NULL DEFAULT false,
    active_from timestamptz NOT NULL DEFAULT now(),
    active_to   timestamptz CHECK (active_to >= active_from),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT apps_default_available CHECK (NOT is_default OR is_available)
);

CREATE TRIGGER apps_updated_at BEFORE UPDATE ON apps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everyone reads; only the seed file (the owning migration role) writes. No write
-- policy, so the runtime role cannot change the catalogue (deny by default).
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY apps_read ON apps FOR SELECT USING (true);

-- Every change is audited (C164).
SELECT audit.enable('apps');
