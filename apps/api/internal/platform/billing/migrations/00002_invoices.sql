-- Invoices (C173; fields confirmed 2026-10-07): what a tenant is billed for one period
-- under its agreement. Their lines are in invoice_lines. A draft is Bool's to edit;
-- issuing gives it its number and freezes it, after which only its status moves on
-- (paid, or void to cancel it). A correction is a credit note and a new invoice. "Due"
-- and "Overdue" are an issued invoice before and after due_on, and "Credited" comes
-- from credit notes: none is stored. The schema only: no invoice is created by a
-- migration (C135).

-- +goose Up
CREATE TABLE invoices (
    id           uuid          PRIMARY KEY DEFAULT uuidv7(),
    tenant_id    uuid          NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
    -- The terms it was priced under: one of the tenant's own agreements.
    agreement_id uuid          NOT NULL,
    -- Given when it is issued, never reused.
    number       text          UNIQUE CHECK (btrim(number) <> ''),
    status       text          NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'issued', 'paid', 'void')),
    -- The service period billed.
    period_start date          NOT NULL,
    period_end   date          NOT NULL CHECK (period_end >= period_start),
    issued_on    date,
    due_on       date          CHECK (due_on >= issued_on),
    paid_on      date,
    -- Copied from the agreement, so a later change of terms never alters it.
    currency     char(3)       NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    subtotal     numeric(19,4) NOT NULL CHECK (subtotal >= 0),
    tax_rate     numeric(5,2)  NOT NULL CHECK (tax_rate BETWEEN 0 AND 100),
    tax_amount   numeric(19,4) NOT NULL CHECK (tax_amount >= 0),
    total        numeric(19,4) NOT NULL,
    -- The customer's purchase-order number for this invoice.
    po_reference text          CHECK (btrim(po_reference) <> ''),
    notes        text,
    issued_by    uuid          REFERENCES users (id) ON DELETE RESTRICT,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(),

    -- Tenant tables (lines, credits, payments) reference an invoice with its tenant.
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, agreement_id) REFERENCES billing_agreements (tenant_id, id) ON DELETE RESTRICT,
    CHECK (total = subtotal + tax_amount),
    -- An issued (or paid) invoice has its number and dates; a paid one its payment date.
    CHECK (status NOT IN ('issued', 'paid') OR (number IS NOT NULL AND issued_on IS NOT NULL AND due_on IS NOT NULL)),
    CHECK (status <> 'paid' OR paid_on IS NOT NULL),
    CHECK (status <> 'draft' OR number IS NULL)
);

CREATE INDEX invoices_tenant ON invoices (tenant_id);
CREATE INDEX invoices_agreement ON invoices (agreement_id);

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- +goose StatementBegin
-- An invoice copies its agreement's currency and tax rate and bills a period inside the
-- agreement. Once issued it is frozen: only its status moves on (issued to paid or void),
-- with the payment date; a draft may be issued or voided. Its tenant and agreement never
-- change.
CREATE FUNCTION invoices_valid() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    agreement billing_agreements%ROWTYPE;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id THEN
            RAISE EXCEPTION 'invoice %: its tenant and agreement cannot change', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.status <> 'draft' THEN
            IF NOT ((OLD.status = 'issued' AND NEW.status IN ('issued', 'paid', 'void'))
                    OR (OLD.status = NEW.status)) THEN
                RAISE EXCEPTION 'invoice %: % cannot become %', OLD.id, OLD.status, NEW.status
                    USING ERRCODE = 'check_violation';
            END IF;
            IF (NEW.number, NEW.period_start, NEW.period_end, NEW.issued_on, NEW.due_on, NEW.currency,
                NEW.subtotal, NEW.tax_rate, NEW.tax_amount, NEW.total, NEW.po_reference, NEW.notes, NEW.issued_by)
               IS DISTINCT FROM
               (OLD.number, OLD.period_start, OLD.period_end, OLD.issued_on, OLD.due_on, OLD.currency,
                OLD.subtotal, OLD.tax_rate, OLD.tax_amount, OLD.total, OLD.po_reference, OLD.notes, OLD.issued_by)
               OR (OLD.status <> 'issued' AND NEW.paid_on IS DISTINCT FROM OLD.paid_on) THEN
                RAISE EXCEPTION 'invoice % is %: it cannot change', OLD.id, OLD.status
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN NEW;
        END IF;
    END IF;
    SELECT * INTO agreement FROM billing_agreements WHERE id = NEW.agreement_id;
    IF NEW.currency <> agreement.currency OR NEW.tax_rate <> agreement.tax_rate THEN
        RAISE EXCEPTION 'invoice %: its currency and tax rate must be its agreement''s', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.period_start < agreement.starts_on OR NEW.period_end > coalesce(agreement.ends_on, 'infinity') THEN
        RAISE EXCEPTION 'invoice %: its period is outside its agreement', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
-- +goose StatementEnd
CREATE TRIGGER invoices_valid BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION invoices_valid();

-- Row-level security (C115): the operator tenant reads and writes every invoice; a
-- tenant reads its own issued invoices (drafts are Bool's), and a payer the issued
-- invoices of the agreements it pays for. Tenants never write. Nothing deletes one (it
-- is voided). Enabled, not forced, like the registry.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_read ON invoices FOR SELECT
    USING (lookup.is_operator_tenant(current_tenant_id())
           OR (status <> 'draft'
               AND (tenant_id = current_tenant_id()
                    OR EXISTS (SELECT 1 FROM billing_agreements a
                                WHERE a.id = agreement_id AND a.payer_tenant_id = current_tenant_id()))));
CREATE POLICY invoices_create ON invoices FOR INSERT
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));
CREATE POLICY invoices_update ON invoices FOR UPDATE
    USING (lookup.is_operator_tenant(current_tenant_id()))
    WITH CHECK (lookup.is_operator_tenant(current_tenant_id()));

-- Every change is audited (C164).
SELECT audit.enable('invoices');
