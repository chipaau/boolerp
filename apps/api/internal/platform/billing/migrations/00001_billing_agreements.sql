-- Billing agreements (C171; fields confirmed 2026-10-06): what a tenant has agreed to
-- pay. Pricing is agreed per client, monthly or yearly; there is no plan catalogue yet.
-- An agreement can be a flat price per cycle, a price per seat, or both. Changing the
-- terms ends the current agreement (ends_on) and starts a new one, so invoices keep the
-- terms they were priced under. The schema only: no agreement is created by a
-- migration (C135).

-- +goose Up
CREATE TABLE billing_agreements (
    id                 uuid          PRIMARY KEY DEFAULT uuidv7(),
    tenant_id          uuid          NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    -- Who pays when it is not the tenant itself (a ministry paying for its hospitals);
    -- null when the tenant pays.
    payer_tenant_id    uuid          REFERENCES tenants (id) ON DELETE RESTRICT
                       CHECK (payer_tenant_id <> tenant_id),
    cycle              text          NOT NULL CHECK (cycle IN ('monthly', 'yearly')),
    -- ISO 4217.
    currency           char(3)       NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    -- Money is exact decimal, never floating point. The fixed price per cycle (0 for
    -- seats only), the price per seat per cycle (null when not charged per seat), and
    -- the one-time setup price.
    recurring_amount   numeric(19,4) NOT NULL CHECK (recurring_amount >= 0),
    per_seat_amount    numeric(19,4) CHECK (per_seat_amount >= 0),
    setup_amount       numeric(19,4) CHECK (setup_amount >= 0),
    -- Percent: 0 when exempt. Per agreement, so no country's rate is in code.
    tax_rate           numeric(5,2)  NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 100),
    -- Null: no limit.
    seat_limit         integer       CHECK (seat_limit > 0),
    -- The first billing period starts here; periods and renewals follow from the cycle.
    starts_on          date          NOT NULL,
    -- The last day it covers, set when it is replaced or ended (the next one starts the
    -- day after).
    ends_on            date          CHECK (ends_on >= starts_on),
    contract_reference text          CHECK (btrim(contract_reference) <> ''),
    notes              text,
    -- The operator who recorded it; null when a seed did.
    created_by         uuid          REFERENCES users (id) ON DELETE RESTRICT,
    created_at         timestamptz   NOT NULL DEFAULT now(),
    updated_at         timestamptz   NOT NULL DEFAULT now(),

    -- Tenant tables (invoices) reference an agreement with its tenant.
    UNIQUE (tenant_id, id),
    -- A tenant's agreements never overlap in time (ends_on inclusive; an open one runs
    -- on), so it has at most one open agreement. Needs btree_gist, created by the
    -- database setup.
    CONSTRAINT billing_agreements_no_overlap EXCLUDE USING gist (
        tenant_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&
    )
);
-- Agreements a tenant pays for on others' behalf.
CREATE INDEX billing_agreements_payer ON billing_agreements (payer_tenant_id) WHERE payer_tenant_id IS NOT NULL;

CREATE TRIGGER billing_agreements_updated_at BEFORE UPDATE ON billing_agreements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose StatementBegin
-- An agreement's tenant never changes.
CREATE FUNCTION billing_agreements_tenant_locked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
        RAISE EXCEPTION 'billing agreement %: its tenant cannot change', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER billing_agreements_tenant_locked BEFORE UPDATE OF tenant_id ON billing_agreements
    FOR EACH ROW EXECUTE FUNCTION billing_agreements_tenant_locked();

-- Row-level security (C115): the operator tenant reads and writes every agreement; a
-- tenant reads its own, and a payer the ones it pays for. Tenants never write. Nothing
-- deletes one (it is ended). Enabled, not forced, like the registry: the owning
-- migration role may seed them.
ALTER TABLE billing_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_agreements_read ON billing_agreements FOR SELECT
    USING (tenant_id = current_tenant_id() OR payer_tenant_id = current_tenant_id()
           OR lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY billing_agreements_create ON billing_agreements FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY billing_agreements_update ON billing_agreements FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));

-- Every change is audited (C164).
SELECT audit.enable('billing_agreements');
