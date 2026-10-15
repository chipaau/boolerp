-- Capabilities (C168; fields confirmed 2026-10-06): what a role may grant, mirrored from
-- code like apps (C165). Each app declares the capabilities its roles grant; the
-- authorization.capabilities seed file writes them here on every cmd/deploy and cmd/seed,
-- so role_capabilities can reference them. Named <module>:<resource>:<level> (C153); the
-- module may differ from the app (the admin console grants tenancy:tenant:*). Global.

-- +goose Up
CREATE TABLE capabilities (
    key         text        PRIMARY KEY
                CHECK (key ~ '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*:(view|manage|delete)$'),
    -- The one app whose roles may grant it.
    app_key     text        NOT NULL REFERENCES apps (key) ON DELETE RESTRICT,
    name        text        NOT NULL CHECK (btrim(name) <> ''),
    description text,
    active_from timestamptz NOT NULL DEFAULT now(),
    active_to   timestamptz CHECK (active_to >= active_from),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER capabilities_updated_at BEFORE UPDATE ON capabilities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everyone reads; only the seed file (the owning migration role) writes.
ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY capabilities_read ON capabilities FOR SELECT USING (true);

-- Every change is audited (C164).
SELECT audit.enable('capabilities');
