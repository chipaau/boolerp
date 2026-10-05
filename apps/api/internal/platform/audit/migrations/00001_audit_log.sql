-- The audit log (C146, C147, C164; fields confirmed 2026-10-06): one append-only table of
-- every change to every table, written only by the capture trigger in the same
-- transaction as the change. Partitioned by month on occurred_at; cmd/deploy and cmd/seed
-- create the months ahead (audit.create_partitions), and the default partition keeps any
-- row outside them. The audit module migrates first, so every later table's migration
-- can call audit.enable. Owned by erp_audit, the login-less role that alone writes it.

-- +goose Up
SET LOCAL ROLE erp_audit;

CREATE TABLE audit_log (
    id              uuid        NOT NULL DEFAULT uuidv7(),
    -- The transaction's time, so one operation's rows share it.
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    -- The row's tenant (tenants: its own id; global tables: none). No foreign key: the
    -- audit never depends on, or blocks, the registry.
    tenant_id       uuid,
    action          text        NOT NULL CHECK (action IN ('insert', 'update', 'delete', 'read')),
    -- The table, or a read event's name (C148).
    entity          text        NOT NULL CHECK (btrim(entity) <> ''),
    -- The row's primary key: its id, or its key columns joined with '/'.
    record_id       text        NOT NULL,
    -- Insert: the new row; delete: the old row; update: only the changed columns.
    -- Excluded columns never have values here.
    old_values      jsonb,
    new_values      jsonb,
    -- Update only: every changed column, excluded ones included.
    changed_columns text[],
    -- Who and through what, from the app.* settings tenant.Tx and the other entry points
    -- apply (C147); the database role always, so manual fixes are attributed.
    actor_user_id   uuid,
    actor_client_id text,
    actor_tenant_id uuid,
    operation       text,
    request_id      text,
    ip              inet,
    db_role         text        NOT NULL DEFAULT session_user,
    PRIMARY KEY (occurred_at, id)
) PARTITION BY RANGE (occurred_at);

-- Rows outside the created months land here, so none is ever lost (C146).
CREATE TABLE audit.audit_log_default PARTITION OF audit_log DEFAULT;

-- +goose StatementBegin
-- Append-only: nothing updates, deletes, or truncates audit rows, the owner included.
-- Old months are detached and dropped by the retention job, never emptied (C146).
CREATE FUNCTION audit.refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit.refuse_change();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION audit.refuse_change();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit.audit_log_default
    FOR EACH STATEMENT EXECUTE FUNCTION audit.refuse_change();

-- +goose StatementBegin
-- The capture trigger (C147): one audit row per changed row, in the same transaction.
-- Its arguments, set by audit.enable: the excluded columns, the primary key columns,
-- and the tenant column ('' for a global table). An update that changes nothing but
-- updated_at records nothing. SECURITY DEFINER as erp_audit, the table's owner, so the
-- runtime role writes audit rows only through it.
CREATE FUNCTION audit.capture() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
DECLARE
    excluded   text[] := TG_ARGV[0]::text[];
    keys       text[] := TG_ARGV[1]::text[];
    tenant_col text   := TG_ARGV[2];
    old_row    jsonb;
    new_row    jsonb;
    cur        jsonb;
    changed    text[];
    old_vals   jsonb;
    new_vals   jsonb;
BEGIN
    IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
    cur := coalesce(new_row, old_row);

    IF TG_OP = 'UPDATE' THEN
        SELECT array_agg(n.key ORDER BY n.key) INTO changed
          FROM jsonb_each(new_row) n
         WHERE n.key <> 'updated_at' AND n.value IS DISTINCT FROM old_row -> n.key;
        IF changed IS NULL THEN
            RETURN NULL;
        END IF;
        SELECT jsonb_object_agg(c, old_row -> c), jsonb_object_agg(c, new_row -> c)
          INTO old_vals, new_vals
          FROM unnest(changed) c
         WHERE c <> ALL (excluded);
    ELSE
        old_vals := old_row - excluded;
        new_vals := new_row - excluded;
    END IF;

    INSERT INTO public.audit_log (tenant_id, action, entity, record_id, old_values, new_values,
                                  changed_columns, actor_user_id, actor_client_id, actor_tenant_id,
                                  operation, request_id, ip)
    VALUES (
        CASE WHEN tenant_col <> '' THEN (cur ->> tenant_col)::uuid END,
        lower(TG_OP),
        TG_TABLE_NAME,
        (SELECT string_agg(cur ->> k, '/' ORDER BY o) FROM unnest(keys) WITH ORDINALITY AS u(k, o)),
        old_vals,
        new_vals,
        changed,
        nullif(current_setting('app.actor_user_id', true), '')::uuid,
        nullif(current_setting('app.actor_client_id', true), ''),
        nullif(current_setting('app.actor_tenant_id', true), '')::uuid,
        nullif(current_setting('app.operation', true), ''),
        nullif(current_setting('app.request_id', true), ''),
        nullif(current_setting('app.ip', true), '')::inet
    );
    RETURN NULL;
END;
$$;

-- audit.enable(table, exclude, tenant_column) puts the capture trigger on a table; every
-- table's migration calls it (C164), and a feature test fails for any table without it.
-- exclude: columns recorded as changed but never with values (secrets, sensitive data).
-- tenant_column: the column holding the row's tenant; by default tenant_id when the table
-- has one, otherwise none (a global table). Run by the migration role, which owns the
-- table; erp_audit owns the function, which runs as its caller.
CREATE FUNCTION audit.enable(tbl regclass, exclude text[] DEFAULT '{}', tenant_column text DEFAULT NULL)
    RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog
    AS $$
DECLARE
    keys    text[];
    missing text;
BEGIN
    SELECT array_agg(a.attname::text ORDER BY k.o) INTO keys
      FROM pg_index i
     CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, o)
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = tbl AND i.indisprimary;
    IF keys IS NULL THEN
        RAISE EXCEPTION '%: an audited table needs a primary key', tbl;
    END IF;

    SELECT c INTO missing FROM unnest(exclude || coalesce(tenant_column, '')) c
     WHERE c <> '' AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                                    WHERE a.attrelid = tbl AND a.attname = c AND a.attnum > 0
                                      AND NOT a.attisdropped)
     LIMIT 1;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION '%: no column %', tbl, missing;
    END IF;

    IF tenant_column IS NULL THEN
        tenant_column := CASE WHEN EXISTS (SELECT 1 FROM pg_attribute a
                                            WHERE a.attrelid = tbl AND a.attname = 'tenant_id'
                                              AND NOT a.attisdropped)
                              THEN 'tenant_id' ELSE '' END;
    END IF;

    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON %s '
                   'FOR EACH ROW EXECUTE FUNCTION audit.capture(%L, %L, %L)',
                   tbl, exclude, keys, tenant_column);
END;
$$;

-- audit.create_partitions(parent, months) creates the monthly partitions of parent (an
-- erp_audit table: audit_log) for the current month and the next months - 1, in UTC,
-- each in the audit schema with the no-truncate guard. Existing months are left as they
-- are. cmd/deploy and cmd/seed call it (the audit.partitions seed file). SECURITY DEFINER
-- as erp_audit, which owns the parent; only the migration role may execute it.
CREATE FUNCTION audit.create_partitions(parent regclass, months int)
    RETURNS int
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$
DECLARE
    first   date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
    m       date;
    part    text;
    created int  := 0;
BEGIN
    IF (SELECT relowner FROM pg_class WHERE oid = parent) <> (SELECT oid FROM pg_roles WHERE rolname = 'erp_audit') THEN
        RAISE EXCEPTION '%: not an audit table', parent;
    END IF;
    FOR i IN 0 .. months - 1 LOOP
        m := first + make_interval(months => i);
        part := format('%s_y%sm%s', (SELECT relname FROM pg_class WHERE oid = parent),
                       to_char(m, 'YYYY'), to_char(m, 'MM'));
        CONTINUE WHEN to_regclass(format('audit.%I', part)) IS NOT NULL;
        EXECUTE format('CREATE TABLE audit.%I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
                       part, parent, m::text || ' 00:00:00+00',
                       (m + make_interval(months => 1))::date::text || ' 00:00:00+00');
        EXECUTE format('CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit.%I '
                       'FOR EACH STATEMENT EXECUTE FUNCTION audit.refuse_change()', part);
        created := created + 1;
    END LOOP;
    RETURN created;
END;
$$;

-- Row-level security (C147): a tenant reads its own rows (the API checks audit:view with
-- Cerbos), the operator tenant reads every row; nothing else, and no one but erp_audit
-- (the owner, through the trigger) writes. The check is a PL/pgSQL function so that it
-- binds the tenancy module's lookup.is_operator_tenant when called, not now (the audit
-- module migrates first).
CREATE FUNCTION audit_log_readable(row_tenant uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    SET search_path = pg_catalog
    AS $$
DECLARE
    acting uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
    IF acting IS NULL THEN
        RETURN false;
    END IF;
    RETURN row_tenant = acting OR lookup.is_operator_tenant(acting);
END;
$$;
-- +goose StatementEnd

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_read ON audit_log FOR SELECT USING (audit_log_readable(tenant_id));

RESET ROLE;
