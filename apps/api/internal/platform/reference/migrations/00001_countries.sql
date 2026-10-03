-- Countries (C120, C121, C122; fields confirmed 2026-10-03; meaning changed 2026-10-04,
-- C135): the ISO 3166-1 countries and territories, owned by the platform's reference
-- data. Legal forms and tenants belong to one, and HRMS and identity use them too; a
-- country is offered when it has legal forms. Global, not tenant-scoped. The schema
-- only: the list is a seed file (reference/seeds/countries.csv) that cmd/deploy loads.

-- +goose Up
CREATE TABLE countries (
    code         char(2)     PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),  -- ISO 3166-1 alpha-2
    alpha3       char(3)     NOT NULL UNIQUE CHECK (alpha3 ~ '^[A-Z]{3}$'),  -- ISO 3166-1 alpha-3
    name         text        NOT NULL CHECK (btrim(name) <> ''),
    phone_prefix text        NOT NULL CHECK (phone_prefix ~ '^\+[0-9]{1,4}$'),
    active_from  timestamptz NOT NULL DEFAULT now(),  -- when the code entered the list
    active_to    timestamptz CHECK (active_to >= active_from),  -- when ISO withdrew it; null = current
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- updated_at follows every change, whichever code makes it.
-- +goose StatementBegin
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER countries_updated_at BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Everyone reads; writes are for the operator tenant only (C120). Until that rule
-- exists there is no write policy, so the runtime role cannot change countries at
-- all (deny by default). Row-level security is enabled but not forced, so the
-- owning migration role can still maintain the data.
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY countries_read ON countries FOR SELECT USING (true);
