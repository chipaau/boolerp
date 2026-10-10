-- Tenants (C115, C136, C141, C195; fields confirmed 2026-10-04, changed 2026-10-08):
-- the registry of customer organisations, each one data boundary, and the single
-- operator tenant (Bool). Its institution types, the primary one flagged, are in
-- tenant_institution_types (00002). Classification references the reference module's
-- lists (C134 allows the foreign keys). The schema only: no tenant is created by a
-- migration (C135).

-- +goose Up

-- The request's tenant, set per transaction with SET LOCAL (C115). Unset or empty
-- is no tenant: policies then match nothing (fail closed).
CREATE FUNCTION current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;

CREATE TABLE tenants (
    id               uuid        PRIMARY KEY DEFAULT uuidv7(),
    -- A DNS label (3-63 characters), never a name the platform uses itself.
    slug             text        NOT NULL UNIQUE
                     CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$')
                     CHECK (slug NOT IN ('admin', 'api', 'app', 'auth', 'identity', 'login', 'www',
                                         'mail', 'smtp', 'imap', 'ftp', 'oidc', 'static', 'assets',
                                         'cdn', 'status', 'docs', 'help', 'support', 'billing',
                                         'bool', 'operator', 'root', 'system')),
    code             text        NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{2,10}$'),
    name             text        NOT NULL CHECK (btrim(name) <> ''),
    parent_id        uuid        REFERENCES tenants (id) ON DELETE RESTRICT CHECK (parent_id <> id),
    is_operator      boolean     NOT NULL DEFAULT false,
    country          char(2)     NOT NULL REFERENCES countries (code) ON DELETE RESTRICT,
    legal_form_id    uuid        NOT NULL,
    -- The number of the document the legal form names; the application requires it
    -- when the form names one and refuses it when the form names none.
    identity_number  text        CHECK (btrim(identity_number) <> ''),
    registered_on    date,
    -- The tax registration number (TIN) printed on invoices (C172); null when the
    -- organisation has none. Formats differ by country, so only blanks are refused.
    tax_number       text        CHECK (btrim(tax_number) <> ''),
    timezone         text        NOT NULL CHECK (btrim(timezone) <> ''),  -- IANA name, checked by the application
    email            text        CHECK (btrim(email) <> ''),
    phone            text        CHECK (phone ~ '^\+[0-9]{6,15}$'),
    status           text        NOT NULL DEFAULT 'provisioning'
                     CHECK (status IN ('provisioning', 'active', 'suspended', 'archived')),
    activated_at     timestamptz,
    suspended_at     timestamptz,
    archived_at      timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    -- The legal form must be one of the tenant's own country.
    FOREIGN KEY (legal_form_id, country) REFERENCES legal_forms (id, country) ON DELETE RESTRICT,
    -- The legal form and time zone are required from creation (C195); the primary
    -- institution type, required before a tenant leaves provisioning, is checked by
    -- tenant_institution_types (00002).
    -- The status timestamps follow the status.
    CHECK (status NOT IN ('active', 'suspended') OR activated_at IS NOT NULL),
    CHECK (status <> 'suspended' OR suspended_at IS NOT NULL),
    CHECK (status <> 'archived' OR archived_at IS NOT NULL),
    -- The operator is never suspended or archived and has no parent.
    CHECK (NOT is_operator OR (status IN ('provisioning', 'active') AND parent_id IS NULL))
);

-- At most one operator tenant.
CREATE UNIQUE INDEX tenants_one_operator ON tenants (is_operator) WHERE is_operator;
-- A registration number belongs to one organisation in a country.
CREATE UNIQUE INDEX tenants_identity_number ON tenants (country, upper(identity_number))
    WHERE identity_number IS NOT NULL;
-- A tax number belongs to one organisation in a country.
CREATE UNIQUE INDEX tenants_tax_number ON tenants (country, upper(tax_number))
    WHERE tax_number IS NOT NULL;
CREATE INDEX tenants_parent ON tenants (parent_id);

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A slug is the tenant's web address: once the tenant has been active, links and
-- bookmarks depend on it, so it no longer changes.
-- +goose StatementBegin
CREATE FUNCTION tenants_slug_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.activated_at IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
        RAISE EXCEPTION 'tenant % has been active: its slug cannot change', OLD.code
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER tenants_slug_locked BEFORE UPDATE OF slug ON tenants
    FOR EACH ROW EXECUTE FUNCTION tenants_slug_locked();

-- The operator tenant, as erp_lookup (C131): policies on tenants cannot query
-- tenants themselves (PostgreSQL rejects the recursion), so the check reads past
-- row-level security through this one narrow function: given a tenant, is it the
-- operator? It reads two columns and nothing else.
GRANT SELECT (id, is_operator) ON tenants TO erp_lookup;
SET LOCAL ROLE erp_lookup;
-- +goose StatementBegin
CREATE FUNCTION lookup.is_operator_tenant(tenant uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$ SELECT coalesce((SELECT t.is_operator FROM public.tenants t WHERE t.id = tenant), false) $$;
-- +goose StatementEnd
RESET ROLE;

-- A parent is never the operator, and a tenant is never its own ancestor.
-- +goose StatementBegin
CREATE FUNCTION tenants_parent_valid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF lookup.is_operator_tenant(NEW.parent_id) THEN
        RAISE EXCEPTION 'the operator tenant cannot be a parent' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
        WITH RECURSIVE ancestors (id, parent_id) AS (
            SELECT t.id, t.parent_id FROM tenants t WHERE t.id = NEW.parent_id
            UNION
            SELECT t.id, t.parent_id FROM tenants t JOIN ancestors a ON t.id = a.parent_id
        )
        SELECT 1 FROM ancestors WHERE id = NEW.id
    ) THEN
        RAISE EXCEPTION 'tenant % would be its own ancestor', NEW.code USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER tenants_parent_valid BEFORE INSERT OR UPDATE OF parent_id ON tenants
    FOR EACH ROW EXECUTE FUNCTION tenants_parent_valid();

-- Row-level security (C115): a tenant reads its own row; the operator tenant reads
-- every row and alone creates and changes them. Nothing deletes a tenant (it is
-- archived), so there is no delete policy. The runtime role can never create an
-- operator or change is_operator: inserts must be non-operator rows, and an update
-- must keep the flag it had. Only the owning migration role, which row-level
-- security does not bind, creates the operator tenant. Enabled, not forced: the
-- registry has no tenant_id of its own, and the owner maintains it.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenants_read ON tenants FOR SELECT
    USING (id = current_tenant_id() OR lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY tenants_create ON tenants FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()) AND NOT is_operator);
CREATE POLICY tenants_update ON tenants FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()) AND is_operator = lookup.is_operator_tenant(id));

-- Every change is audited (C164); a tenant's rows are its own, by its id.
SELECT audit.enable('tenants', tenant_column => 'id');
