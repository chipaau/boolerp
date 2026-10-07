-- Invoice lines (C181; fields confirmed 2026-10-07): what an invoice's subtotal adds up
-- from, such as the agreement's fixed price, seats, setup, or anything agreed case by
-- case. Lines change only while their invoice is a draft; issuing checks that the
-- subtotal equals their sum. The schema only: no line is created by a migration (C135).

-- +goose Up
CREATE TABLE invoice_lines (
    id          uuid          PRIMARY KEY DEFAULT uuidv7(),
    tenant_id   uuid          NOT NULL,
    -- With tenant_id, so a line is always on its own tenant's invoice.
    invoice_id  uuid          NOT NULL,
    -- Its order on the invoice.
    position    integer       NOT NULL CHECK (position > 0),
    -- recurring (the agreement's fixed price), seats, setup, or other: lets reports split
    -- revenue without reading the labels.
    kind        text          NOT NULL CHECK (kind IN ('recurring', 'seats', 'setup', 'other')),
    description text          NOT NULL CHECK (btrim(description) <> ''),
    quantity    numeric(19,4) NOT NULL CHECK (quantity > 0),
    -- Negative for a discount line (there are no credit notes or refunds, C182).
    unit_amount numeric(19,4) NOT NULL,
    amount      numeric(19,4) NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),

    FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices (tenant_id, id) ON DELETE RESTRICT,
    UNIQUE (invoice_id, position),
    CHECK (amount = round(quantity * unit_amount, 4))
);

CREATE TRIGGER invoice_lines_updated_at BEFORE UPDATE ON invoice_lines
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose StatementBegin
-- Lines are added, changed, and removed only while their invoice is a draft, and a line
-- never moves to another invoice.
CREATE FUNCTION invoice_lines_on_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    line invoice_lines%ROWTYPE;
    invoice_status text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        line := OLD;
    ELSE
        line := NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id) THEN
        RAISE EXCEPTION 'invoice line %: its invoice cannot change', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    SELECT status INTO invoice_status FROM invoices WHERE id = line.invoice_id;
    IF invoice_status <> 'draft' THEN
        RAISE EXCEPTION 'invoice % is %: its lines cannot change', line.invoice_id, invoice_status
            USING ERRCODE = 'check_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Issuing an invoice (or inserting one already issued) checks that its subtotal is the
-- sum of its lines; an invoice with no lines has a subtotal of 0.
CREATE FUNCTION invoices_lines_add_up() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR OLD.status = 'draft') AND NEW.status IN ('issued', 'paid')
       AND NEW.subtotal <> (SELECT coalesce(sum(l.amount), 0) FROM invoice_lines l WHERE l.invoice_id = NEW.id) THEN
        RAISE EXCEPTION 'invoice %: its subtotal is not the sum of its lines', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER invoice_lines_on_draft BEFORE INSERT OR UPDATE OR DELETE ON invoice_lines
    FOR EACH ROW EXECUTE FUNCTION invoice_lines_on_draft();
CREATE TRIGGER invoices_lines_add_up BEFORE INSERT OR UPDATE OF status ON invoices
    FOR EACH ROW EXECUTE FUNCTION invoices_lines_add_up();

-- Row-level security, as for invoices (C173): the operator tenant reads and writes every
-- line; a tenant reads the lines of its own issued invoices, and a payer those of the
-- issued invoices it pays for. Tenants never write. Only a draft's lines are deleted (the
-- trigger). Enabled, not forced, like the registry.
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_lines_read ON invoice_lines FOR SELECT
    USING (lookup.is_operator_tenant(current_tenant_id())
           OR EXISTS (SELECT 1 FROM invoices i
                       WHERE i.id = invoice_id AND i.status <> 'draft'
                         AND (i.tenant_id = current_tenant_id()
                              OR EXISTS (SELECT 1 FROM billing_agreements a
                                          WHERE a.id = i.agreement_id AND a.payer_tenant_id = current_tenant_id()))));
CREATE POLICY invoice_lines_create ON invoice_lines FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY invoice_lines_update ON invoice_lines FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY invoice_lines_delete ON invoice_lines FOR DELETE
    USING (lookup.is_operator_tenant(current_tenant_id()));

-- Every change is audited (C164).
SELECT audit.enable('invoice_lines');
