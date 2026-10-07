-- The operator lookup (C178): which tenant the admin console's requests act in, for
-- ResolveOperator, before the request's transaction (C131). Owned by erp_lookup, reading
-- only columns already granted to it (00001, 00003).

-- +goose Up
SET LOCAL ROLE erp_lookup;
-- +goose StatementBegin
CREATE FUNCTION lookup.operator_tenant()
    RETURNS TABLE (tenant_id uuid, tenant_code text, tenant_status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path = pg_catalog
    AS $$ SELECT t.id, t.code, t.status FROM public.tenants t WHERE t.is_operator $$;
-- +goose StatementEnd
RESET ROLE;
